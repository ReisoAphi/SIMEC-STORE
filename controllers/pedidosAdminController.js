// controllers/pedidosAdminController.js
const { pool } = require('../config/database');
const facturama = require('../services/facturama');
const emails = require('../services/emails');
const { getAdminPedidosHTML } = require('../views/adminPedidos');
const { getAdminPedidoDetalleHTML } = require('../views/adminPedidoDetalle');

const ESTATUS_VALIDOS = ['pendiente_pago', 'pagado', 'empacando', 'enviado', 'entregado', 'cancelado'];

// GET /admin/pedidos
exports.list = async (req, res) => {
    try {
        const { q = '', estatus = '', desde = '', hasta = '' } = req.query;
        const params = [];
        const where = [];

        if (q.trim()) {
            params.push('%' + q.trim().toLowerCase() + '%');
            where.push(`(LOWER(p.folio) LIKE $${params.length} OR LOWER(c.email) LIKE $${params.length} OR LOWER(c.nombre) LIKE $${params.length})`);
        }
        if (estatus && ESTATUS_VALIDOS.includes(estatus)) {
            params.push(estatus);
            where.push(`p.estatus = $${params.length}`);
        }
        if (desde) { params.push(desde); where.push(`p.creado_en >= $${params.length}`); }
        if (hasta) { params.push(hasta + ' 23:59:59'); where.push(`p.creado_en <= $${params.length}`); }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const pedidos = await pool.query(`
            SELECT p.*, c.email, c.nombre AS cliente_nombre
              FROM pedidos p
         LEFT JOIN clientes c ON c.id = p.cliente_id
             ${whereSql}
          ORDER BY p.creado_en DESC
             LIMIT 200
        `, params);

        res.send(getAdminPedidosHTML(req.adminUser, pedidos.rows, { q, estatus, desde, hasta }));
    } catch (err) {
        console.error('pedidos.list:', err);
        res.status(500).send('Error interno');
    }
};

// GET /admin/pedidos/:id
exports.detalle = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const p = await pool.query(`
            SELECT p.*,
                   c.email, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.razon_social AS cliente_razon,
                   d.calle, d.numero_ext, d.numero_int, d.colonia, d.municipio, d.estado, d.cp, d.referencias
              FROM pedidos p
         LEFT JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN direcciones d ON d.id = p.direccion_envio_id
             WHERE p.id = $1
        `, [id]);
        if (p.rows.length === 0) return res.status(404).send('Pedido no encontrado');
        const pedido = p.rows[0];
        const items = await pool.query(`SELECT * FROM pedido_items WHERE pedido_id=$1 ORDER BY id`, [id]);
        pedido.items = items.rows;
        res.send(getAdminPedidoDetalleHTML(req.adminUser, pedido, { facturamaOk: facturama.configurado }));
    } catch (err) {
        console.error('pedidos.detalle:', err);
        res.status(500).send('Error interno');
    }
};

// PUT /api/admin/pedidos/:id/estatus  { estatus }
exports.cambiarEstatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estatus } = req.body;
        if (!ESTATUS_VALIDOS.includes(estatus)) return res.status(400).json({ error: 'Estatus inválido.' });
        await pool.query(`UPDATE pedidos SET estatus=$1, actualizado_en=NOW() WHERE id=$2`, [estatus, id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('pedidos.cambiarEstatus:', err);
        res.status(500).json({ error: 'Error actualizando estatus.' });
    }
};

// PUT /api/admin/pedidos/:id/guia  { transportista, servicio_envio, guia, tracking_url }
exports.actualizarGuia = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { transportista, servicio_envio, guia, tracking_url } = req.body;
        await pool.query(`
            UPDATE pedidos
               SET transportista=$1, servicio_envio=$2, guia=$3, tracking_url=$4, actualizado_en=NOW()
             WHERE id=$5
        `, [
            (transportista || '').trim() || null,
            (servicio_envio || '').trim() || null,
            (guia || '').trim() || null,
            (tracking_url || '').trim() || null,
            id,
        ]);
        res.json({ ok: true });
    } catch (err) {
        console.error('pedidos.actualizarGuia:', err);
        res.status(500).json({ error: 'Error actualizando guía.' });
    }
};

// GET /admin/pedidos/:id/factura/:tipo  (pdf|xml) — descarga on-demand
exports.descargarFactura = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const tipo = req.params.tipo === 'xml' ? 'xml' : 'pdf';
        const p = await pool.query(`SELECT cfdi_id, folio FROM pedidos WHERE id=$1`, [id]);
        if (p.rows.length === 0 || !p.rows[0].cfdi_id) return res.status(404).send('Sin factura');
        const f = await facturama.descargarCFDI(p.rows[0].cfdi_id, tipo);
        res.setHeader('Content-Type', f.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${p.rows[0].folio}.${tipo}"`);
        res.send(f.buffer);
    } catch (err) {
        console.error('pedidos.descargarFactura:', err);
        res.status(500).send('Error descargando factura: ' + err.message);
    }
};

// POST /api/admin/pedidos/:id/facturar — regenera CFDI (retry manual)
exports.regenerarFactura = async (req, res) => {
    try {
        if (!facturama.configurado) return res.status(400).json({ error: 'Facturama no está configurado.' });
        const id = parseInt(req.params.id, 10);
        const p = await pool.query(`SELECT * FROM pedidos WHERE id=$1`, [id]);
        if (p.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado.' });
        const pedido = p.rows[0];
        if (!pedido.requiere_factura || !pedido.cfdi_receptor) return res.status(400).json({ error: 'Este pedido no requiere factura.' });
        if (pedido.cfdi_id) return res.status(400).json({ error: 'Ya tiene factura generada.' });

        const items = await pool.query(`SELECT * FROM pedido_items WHERE pedido_id=$1`, [id]);
        const cfdi = await facturama.crearCFDI({
            pedido, items: items.rows, receptor: pedido.cfdi_receptor, mpPago: null,
        });
        await pool.query(`
            UPDATE pedidos SET cfdi_id=$1, cfdi_uuid=$2, cfdi_error=NULL, actualizado_en=NOW()
             WHERE id=$3
        `, [cfdi.id, cfdi.uuid, id]);
        res.json({ ok: true, cfdi_id: cfdi.id, uuid: cfdi.uuid });
    } catch (err) {
        console.error('pedidos.regenerarFactura:', err);
        await pool.query(`UPDATE pedidos SET cfdi_error=$1 WHERE id=$2`, [err.message.slice(0, 500), parseInt(req.params.id, 10)]).catch(()=>{});
        res.status(500).json({ error: err.message });
    }
};

// POST /api/admin/pedidos/:id/reenviar-correo
exports.reenviarCorreo = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const p = await pool.query(`
            SELECT p.*, c.email FROM pedidos p LEFT JOIN clientes c ON c.id=p.cliente_id WHERE p.id=$1
        `, [id]);
        if (p.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado.' });
        const pedido = p.rows[0];
        const items = (await pool.query(`SELECT * FROM pedido_items WHERE pedido_id=$1`, [id])).rows;
        await emails.enviarConfirmacionPedido(pedido, items, pedido.email);
        if (pedido.guia) await emails.enviarEnvioListo(pedido, pedido.email);
        res.json({ ok: true });
    } catch (err) {
        console.error('pedidos.reenviarCorreo:', err);
        res.status(500).json({ error: err.message });
    }
};
