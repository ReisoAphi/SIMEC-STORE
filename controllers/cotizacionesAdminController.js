// controllers/cotizacionesAdminController.js
const { pool } = require('../config/database');
const { transporter, MAIL_FROM } = require('../config/mailer');
const emails = require('../services/emails');
const { getAdminCotizacionesHTML } = require('../views/adminCotizaciones');

const ESTATUS = ['nueva', 'respondida', 'convertida', 'rechazada'];

// GET /admin/cotizaciones
exports.list = async (req, res) => {
    try {
        const { q = '', estatus = '' } = req.query;
        const params = [];
        const where = [];
        if (q.trim()) {
            params.push('%' + q.trim().toLowerCase() + '%');
            where.push(`(LOWER(c.folio) LIKE $${params.length} OR LOWER(c.cliente_email) LIKE $${params.length} OR LOWER(c.sku_snapshot) LIKE $${params.length})`);
        }
        if (estatus && ESTATUS.includes(estatus)) {
            params.push(estatus);
            where.push(`c.estatus = $${params.length}`);
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const cots = await pool.query(`
            SELECT c.* FROM cotizaciones c ${whereSql} ORDER BY c.creado_en DESC LIMIT 200
        `, params);
        res.send(getAdminCotizacionesHTML(req.adminUser, cots.rows, { q, estatus }));
    } catch (err) {
        console.error('cotizacionesAdmin.list:', err);
        res.status(500).send('Error interno');
    }
};

// PUT /api/admin/cotizaciones/:id  { estatus?, respuesta? }
exports.actualizar = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estatus, respuesta } = req.body;
        const sets = [];
        const params = [];
        if (estatus) {
            if (!ESTATUS.includes(estatus)) return res.status(400).json({ error: 'Estatus inválido.' });
            params.push(estatus); sets.push(`estatus = $${params.length}`);
        }
        if (respuesta !== undefined) {
            params.push(respuesta || null); sets.push(`respuesta = $${params.length}`);
            params.push(req.adminUser.email); sets.push(`respondido_por = $${params.length}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar.' });
        params.push(id);
        await pool.query(`UPDATE cotizaciones SET ${sets.join(', ')}, actualizado_en=NOW() WHERE id=$${params.length}`, params);
        res.json({ ok: true });
    } catch (err) {
        console.error('cotizacionesAdmin.actualizar:', err);
        res.status(500).json({ error: 'Error actualizando.' });
    }
};

// POST /api/admin/cotizaciones/:id/responder  { mensaje, precio, tiempo_entrega, estatus? }
exports.responder = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { mensaje, precio, tiempo_entrega } = req.body;
        if (!mensaje || !mensaje.trim()) return res.status(400).json({ error: 'Escribe una respuesta.' });

        const c = await pool.query(`SELECT * FROM cotizaciones WHERE id=$1`, [id]);
        if (c.rows.length === 0) return res.status(404).json({ error: 'Cotización no encontrada.' });
        const cot = c.rows[0];

        // Enviar correo al cliente
        await transporter.sendMail({
            from: MAIL_FROM, to: cot.cliente_email,
            subject: `Respuesta a tu cotización ${cot.folio} — SIMEC Store`,
            html: emails.wrap(`
                <h2 style="margin:0 0 10px">Respuesta a tu solicitud</h2>
                <p><strong>Folio:</strong> ${cot.folio}</p>
                ${cot.sku_snapshot ? `<p><strong>Producto:</strong> ${cot.nombre_snapshot} · SKU ${cot.sku_snapshot}${cot.cantidad ? ' · Cantidad: ' + cot.cantidad : ''}</p>` : ''}
                ${precio ? `<p><strong>Precio cotizado:</strong> ${emails.money(precio, 'MXN')}</p>` : ''}
                ${tiempo_entrega ? `<p><strong>Tiempo estimado:</strong> ${tiempo_entrega}</p>` : ''}
                <hr>
                <div style="white-space:pre-wrap;color:#333;line-height:1.6">${String(mensaje).replace(/</g, '&lt;')}</div>
                <hr>
                <p style="color:#888;font-size:12px">Para aceptar o pedir cambios, responde a este correo. Precios sujetos a existencia al momento de confirmar.</p>
            `),
        });

        const respTxt = `${mensaje}${precio ? '\n\nPrecio: $' + precio : ''}${tiempo_entrega ? '\nTiempo entrega: ' + tiempo_entrega : ''}`;
        await pool.query(`
            UPDATE cotizaciones SET estatus='respondida', respuesta=$1, respondido_por=$2, actualizado_en=NOW()
             WHERE id=$3
        `, [respTxt, req.adminUser.email, id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('cotizacionesAdmin.responder:', err);
        res.status(500).json({ error: err.message });
    }
};
