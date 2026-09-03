// controllers/inventarioController.js
const { pool } = require('../config/database');
const { getAdminInventarioHTML, getAdminInventarioHistorialHTML } = require('../views/adminInventario');

const MOTIVOS_VALIDOS = ['compra', 'venta', 'merma', 'ajuste', 'devolucion', 'traspaso'];

// GET /admin/inventario
exports.list = async (req, res) => {
    try {
        const { q = '', filtro = '' } = req.query;
        const params = [];
        const where = ['p.activo = TRUE'];

        if (q.trim()) {
            params.push('%' + q.trim().toLowerCase() + '%');
            where.push(`(LOWER(p.sku) LIKE $${params.length} OR LOWER(p.nombre) LIKE $${params.length})`);
        }

        let havingSql = '';
        if (filtro === 'bajo') havingSql = 'HAVING COALESCE(SUM(i.stock_disponible), 0) <= 3';
        if (filtro === 'cero') havingSql = 'HAVING COALESCE(SUM(i.stock_disponible), 0) = 0';

        const [prods, almacenes] = await Promise.all([
            pool.query(`
                SELECT p.id, p.sku, p.nombre, p.marca,
                       COALESCE(SUM(i.stock_disponible), 0)::int AS stock_total,
                       COALESCE(SUM(i.stock_reservado), 0)::int AS reservado_total,
                       JSON_AGG(JSON_BUILD_OBJECT(
                           'almacen_id', a.id, 'almacen_nombre', a.nombre,
                           'disponible', COALESCE(i.stock_disponible, 0),
                           'reservado', COALESCE(i.stock_reservado, 0),
                           'ubicacion', i.ubicacion
                       ) ORDER BY a.id) AS por_almacen
                  FROM productos p
             CROSS JOIN almacenes a
             LEFT JOIN inventario i ON i.producto_id = p.id AND i.almacen_id = a.id
                 WHERE ${where.join(' AND ')} AND a.activo = TRUE
              GROUP BY p.id
                 ${havingSql}
              ORDER BY p.nombre
                 LIMIT 500
            `, params),
            pool.query(`SELECT id, nombre FROM almacenes WHERE activo = TRUE ORDER BY id`),
        ]);
        res.send(getAdminInventarioHTML(req.adminUser, prods.rows, almacenes.rows, { q, filtro }));
    } catch (err) {
        console.error('inventario.list:', err);
        res.status(500).send('Error interno');
    }
};

// POST /api/admin/inventario/ajustar
// body: { producto_id, almacen_id, delta, motivo, referencia, notas }
exports.ajustar = async (req, res) => {
    const client = await pool.connect();
    try {
        const { producto_id, almacen_id, delta, motivo, referencia, notas } = req.body;
        const pid = parseInt(producto_id, 10);
        const aid = parseInt(almacen_id, 10);
        const d = parseInt(delta, 10);

        if (!pid || !aid) return res.status(400).json({ error: 'Producto y almacén son obligatorios.' });
        if (!Number.isFinite(d) || d === 0) return res.status(400).json({ error: 'El ajuste debe ser distinto de 0.' });
        if (!MOTIVOS_VALIDOS.includes(motivo)) return res.status(400).json({ error: 'Motivo inválido.' });

        await client.query('BEGIN');

        // Upsert de la fila de inventario
        await client.query(`
            INSERT INTO inventario (producto_id, almacen_id, stock_disponible, stock_reservado)
            VALUES ($1, $2, GREATEST($3, 0), 0)
            ON CONFLICT (producto_id, almacen_id) DO UPDATE
              SET stock_disponible = GREATEST(inventario.stock_disponible + $3, 0),
                  actualizado_en = NOW()
        `, [pid, aid, d]);

        // Registro en movimientos
        await client.query(`
            INSERT INTO movimientos_inventario (producto_id, almacen_id, delta, motivo, referencia, notas, usuario_email)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [pid, aid, d, motivo, (referencia || '').trim() || null, (notas || '').trim() || null, req.adminUser.email]);

        await client.query('COMMIT');

        // Nuevo stock actual
        const q = await client.query(`SELECT stock_disponible FROM inventario WHERE producto_id = $1 AND almacen_id = $2`, [pid, aid]);
        const nuevoStock = q.rows[0]?.stock_disponible || 0;

        // Emitir a Socket.io para stock live
        try {
            const io = req.app.get('io');
            if (io) io.to(`producto:${pid}`).emit('stock:update', { productoId: pid, almacenId: aid, stock: nuevoStock });
        } catch (_) { /* ignore */ }

        res.json({ ok: true, stock: nuevoStock });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('inventario.ajustar:', err);
        res.status(500).json({ error: 'Error ajustando inventario.' });
    } finally {
        client.release();
    }
};

// GET /admin/inventario/:productoId/historial
exports.historial = async (req, res) => {
    try {
        const pid = parseInt(req.params.productoId, 10);
        const [prod, mov] = await Promise.all([
            pool.query(`SELECT id, sku, nombre FROM productos WHERE id = $1`, [pid]),
            pool.query(`
                SELECT m.*, a.nombre AS almacen_nombre
                  FROM movimientos_inventario m
             LEFT JOIN almacenes a ON a.id = m.almacen_id
                 WHERE m.producto_id = $1
              ORDER BY m.creado_en DESC
                 LIMIT 200
            `, [pid]),
        ]);
        if (prod.rows.length === 0) return res.status(404).send('Producto no encontrado');
        res.send(getAdminInventarioHistorialHTML(req.adminUser, prod.rows[0], mov.rows));
    } catch (err) {
        console.error('inventario.historial:', err);
        res.status(500).send('Error interno');
    }
};
