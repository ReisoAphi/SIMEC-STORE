// controllers/cotizacionesController.js
const { pool } = require('../config/database');
const { transporter, MAIL_FROM, SALES_INBOX } = require('../config/mailer');
const { STORE_MOUNT, BASE_URL } = require('../config/env');

function generarFolio() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `COT-${stamp}-${rand}`;
}

// POST /api/cotizacion  (público)
exports.crear = async (req, res) => {
    try {
        let { producto_id, cantidad, email, nombre, telefono, empresa, cp, mensaje } = req.body;

        if (!email || !email.includes('@')) return res.status(400).json({ error: 'Correo inválido.' });
        cantidad = Math.max(1, parseInt(cantidad, 10) || 1);
        email = String(email).toLowerCase().trim();

        // Enriquecer con datos del producto (snapshot)
        let sku = null, nombreProd = null;
        if (producto_id) {
            const p = await pool.query(`SELECT sku, nombre FROM productos WHERE id = $1`, [parseInt(producto_id, 10)]);
            if (p.rows.length) { sku = p.rows[0].sku; nombreProd = p.rows[0].nombre; }
        }

        const folio = generarFolio();
        const ins = await pool.query(`
            INSERT INTO cotizaciones (folio, producto_id, sku_snapshot, nombre_snapshot,
                                      cantidad, cliente_email, cliente_nombre, cliente_telefono,
                                      cliente_empresa, cp_destino, mensaje)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
        `, [
            folio,
            producto_id ? parseInt(producto_id, 10) : null,
            sku, nombreProd,
            cantidad, email,
            (nombre || '').trim() || null,
            (telefono || '').trim() || null,
            (empresa || '').trim() || null,
            (cp || '').trim() || null,
            (mensaje || '').trim() || null,
        ]);

        // Envío de correos (best-effort)
        const admincotUrl = `${BASE_URL}${STORE_MOUNT}/admin/cotizaciones`;
        try {
            // Al equipo
            await transporter.sendMail({
                from: MAIL_FROM,
                to: SALES_INBOX,
                subject: `Nueva cotización ${folio}${sku ? ' — ' + sku : ''}`,
                html: `
                    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px">
                        <div style="background:#fff;max-width:600px;margin:0 auto;padding:24px;border-top:4px solid #D90000">
                            <h2 style="margin:0 0 8px;color:#333">Nueva solicitud de cotización</h2>
                            <p style="color:#777;margin:0 0 16px">Folio: <strong>${folio}</strong></p>
                            <table cellpadding="6" style="width:100%;border-collapse:collapse;color:#333">
                                <tr><td style="color:#888">Producto:</td><td>${nombreProd ? `${nombreProd} <br><small style="color:#888">SKU: ${sku}</small>` : '(no especificado)'}</td></tr>
                                <tr><td style="color:#888">Cantidad:</td><td>${cantidad}</td></tr>
                                <tr><td style="color:#888">Correo:</td><td><a href="mailto:${email}">${email}</a></td></tr>
                                <tr><td style="color:#888">Nombre:</td><td>${nombre || '—'}</td></tr>
                                <tr><td style="color:#888">Teléfono:</td><td>${telefono || '—'}</td></tr>
                                <tr><td style="color:#888">Empresa:</td><td>${empresa || '—'}</td></tr>
                                <tr><td style="color:#888">CP destino:</td><td>${cp || '—'}</td></tr>
                                <tr><td style="color:#888;vertical-align:top">Mensaje:</td><td>${(mensaje || '').replace(/\n/g,'<br>') || '—'}</td></tr>
                            </table>
                            <p style="margin-top:20px"><a href="${admincotUrl}" style="background:#D90000;color:#fff;padding:10px 20px;text-decoration:none;font-weight:bold">Abrir bandeja</a></p>
                        </div>
                    </div>
                `
            });
            // Al cliente
            await transporter.sendMail({
                from: MAIL_FROM,
                to: email,
                subject: `Recibimos tu cotización ${folio} — SIMEC Store`,
                html: `
                    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px">
                        <div style="background:#fff;max-width:600px;margin:0 auto;padding:24px;border-top:4px solid #D90000">
                            <h2 style="margin:0 0 8px;color:#333">Recibimos tu solicitud</h2>
                            <p style="color:#555">Gracias por contactar a <strong>SIMEC Automation</strong>. Un asesor te responderá con la cotización personalizada en las próximas horas.</p>
                            <p style="color:#555">Folio: <strong>${folio}</strong></p>
                            ${nombreProd ? `<p style="color:#555">Producto: <strong>${nombreProd}</strong> · SKU: ${sku} · Cantidad: ${cantidad}</p>` : ''}
                            <p style="color:#888;font-size:12px;margin-top:24px">Si tienes prisa, respóndenos a este correo con tus datos adicionales.</p>
                        </div>
                    </div>
                `
            });
        } catch (mailErr) {
            console.warn('cotizacion.crear mail:', mailErr.message);
        }

        res.json({ ok: true, folio });
    } catch (err) {
        console.error('cotizacion.crear:', err);
        res.status(500).json({ error: 'Error registrando la solicitud.' });
    }
};
