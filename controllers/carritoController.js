// controllers/carritoController.js
const { pool } = require('../config/database');
const {
    reservarStock,
    liberarReservasSesionProducto,
    liberarReservasSesion,
} = require('../utils/stock');
const { getPublicCarritoHTML } = require('../views/publicCarrito');

const VENTANA_MIN = 15;

// ---------- Helpers ----------
async function getCarritoDB(client, sesionId) {
    const q = await client.query(`SELECT items FROM carritos WHERE sesion_id = $1`, [sesionId]);
    return q.rows.length ? (q.rows[0].items || []) : [];
}

async function guardarCarritoDB(client, sesionId, items) {
    await client.query(`
        INSERT INTO carritos (sesion_id, items, actualizado_en)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (sesion_id) DO UPDATE SET items = $2::jsonb, actualizado_en = NOW()
    `, [sesionId, JSON.stringify(items)]);
}

async function decorarItems(items, sesionId) {
    if (!items.length) return [];
    const ids = items.map(i => i.producto_id);
    const [q, resv] = await Promise.all([
        pool.query(`
            SELECT p.id, p.sku, p.slug, p.nombre, p.marca, p.precio_lista, p.moneda, p.activo,
                   p.peso_kg, p.largo_cm, p.ancho_cm, p.alto_cm,
                   pi.url AS imagen_url
              FROM productos p
         LEFT JOIN LATERAL (
                SELECT url FROM producto_imagenes
                 WHERE producto_id = p.id
              ORDER BY es_principal DESC, orden ASC, id ASC LIMIT 1
              ) pi ON TRUE
             WHERE p.id = ANY($1::int[])
        `, [ids]),
        sesionId ? pool.query(`
            SELECT producto_id, MAX(expira_en) AS expira_en
              FROM reservas_carrito
             WHERE sesion_id = $1 AND producto_id = ANY($2::int[])
          GROUP BY producto_id
        `, [sesionId, ids]) : { rows: [] },
    ]);
    const byId = Object.fromEntries(q.rows.map(r => [r.id, r]));
    const expiraMap = Object.fromEntries(resv.rows.map(r => [r.producto_id, r.expira_en]));
    return items
        .map(i => ({ ...i, prod: byId[i.producto_id], reserva_expira_en: expiraMap[i.producto_id] || null }))
        .filter(i => i.prod);
}

function calcTotales(itemsDecor) {
    let subtotal = 0;
    for (const it of itemsDecor) subtotal += Number(it.prod.precio_lista) * it.cantidad;
    const iva = 0; // se define en checkout según si el precio incluye IVA o no
    return { subtotal, iva, total: subtotal + iva };
}

// ---------- Vistas ----------
// GET /carrito
exports.page = async (req, res) => {
    try {
        const items = await getCarritoDB(pool, req.sesionId);
        const decor = await decorarItems(items, req.sesionId);
        const totales = calcTotales(decor);
        res.send(getPublicCarritoHTML({ items: decor, totales }));
    } catch (err) {
        console.error('carrito.page:', err);
        res.status(500).send('Error interno');
    }
};

// ---------- APIs ----------
// GET /api/carrito
exports.get = async (req, res) => {
    try {
        const items = await getCarritoDB(pool, req.sesionId);
        const decor = await decorarItems(items, req.sesionId);
        res.json({ ok: true, items: decor, count: decor.reduce((n, i) => n + i.cantidad, 0), totales: calcTotales(decor) });
    } catch (err) {
        console.error('carrito.get:', err);
        res.status(500).json({ error: 'Error obteniendo carrito.' });
    }
};

// POST /api/carrito/agregar  { producto_id, cantidad }
exports.agregar = async (req, res) => {
    const client = await pool.connect();
    try {
        const productoId = parseInt(req.body.producto_id, 10);
        const cantidad = Math.max(1, parseInt(req.body.cantidad, 10) || 1);
        if (!productoId) return res.status(400).json({ error: 'Producto inválido.' });

        // Producto debe existir y estar activo
        const prod = await client.query(`SELECT id, nombre FROM productos WHERE id = $1 AND activo = TRUE`, [productoId]);
        if (prod.rows.length === 0) return res.status(404).json({ error: 'Producto no disponible.' });

        await client.query('BEGIN');

        // Libera cualquier reserva previa de este producto en esta sesión (evita duplicar al re-agregar)
        await liberarReservasSesionProducto(client, req.sesionId, productoId);

        // Reserva stock nuevo
        const r = await reservarStock(client, productoId, req.sesionId, cantidad, VENTANA_MIN);
        if (!r.ok) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: r.error });
        }

        // Actualiza carrito
        const items = await getCarritoDB(client, req.sesionId);
        const idx = items.findIndex(i => i.producto_id === productoId);
        if (idx >= 0) items[idx].cantidad = cantidad;
        else items.push({ producto_id: productoId, cantidad });
        await guardarCarritoDB(client, req.sesionId, items);

        await client.query('COMMIT');

        const decor = await decorarItems(items, req.sesionId);
        // Emite stock actualizado
        try {
            const io = req.app.get('io');
            if (io) io.to(`producto:${productoId}`).emit('stock:reserva', { productoId, cantidad });
        } catch (_) {}

        res.json({ ok: true, count: decor.reduce((n, i) => n + i.cantidad, 0), totales: calcTotales(decor) });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('carrito.agregar:', err);
        res.status(500).json({ error: 'Error agregando al carrito.' });
    } finally {
        client.release();
    }
};

// PUT /api/carrito/actualizar  { producto_id, cantidad }
exports.actualizar = async (req, res) => {
    const client = await pool.connect();
    try {
        const productoId = parseInt(req.body.producto_id, 10);
        const cantidad = parseInt(req.body.cantidad, 10);
        if (!productoId || cantidad < 0) return res.status(400).json({ error: 'Datos inválidos.' });

        await client.query('BEGIN');
        await liberarReservasSesionProducto(client, req.sesionId, productoId);

        const items = await getCarritoDB(client, req.sesionId);
        const idx = items.findIndex(i => i.producto_id === productoId);

        if (cantidad === 0) {
            if (idx >= 0) items.splice(idx, 1);
        } else {
            const r = await reservarStock(client, productoId, req.sesionId, cantidad, VENTANA_MIN);
            if (!r.ok) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: r.error });
            }
            if (idx >= 0) items[idx].cantidad = cantidad;
            else items.push({ producto_id: productoId, cantidad });
        }
        await guardarCarritoDB(client, req.sesionId, items);
        await client.query('COMMIT');

        const decor = await decorarItems(items, req.sesionId);
        res.json({ ok: true, count: decor.reduce((n, i) => n + i.cantidad, 0), totales: calcTotales(decor) });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('carrito.actualizar:', err);
        res.status(500).json({ error: 'Error actualizando carrito.' });
    } finally {
        client.release();
    }
};

// DELETE /api/carrito/:productoId
exports.eliminar = async (req, res) => {
    const client = await pool.connect();
    try {
        const productoId = parseInt(req.params.productoId, 10);
        await client.query('BEGIN');
        await liberarReservasSesionProducto(client, req.sesionId, productoId);

        const items = await getCarritoDB(client, req.sesionId);
        const filtered = items.filter(i => i.producto_id !== productoId);
        await guardarCarritoDB(client, req.sesionId, filtered);

        await client.query('COMMIT');
        const decor = await decorarItems(filtered);
        res.json({ ok: true, count: decor.reduce((n, i) => n + i.cantidad, 0), totales: calcTotales(decor) });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('carrito.eliminar:', err);
        res.status(500).json({ error: 'Error eliminando.' });
    } finally {
        client.release();
    }
};

// DELETE /api/carrito
exports.vaciar = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await liberarReservasSesion(client, req.sesionId);
        await guardarCarritoDB(client, req.sesionId, []);
        await client.query('COMMIT');
        res.json({ ok: true, count: 0, totales: { subtotal: 0, iva: 0, total: 0 } });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('carrito.vaciar:', err);
        res.status(500).json({ error: 'Error vaciando.' });
    } finally {
        client.release();
    }
};
