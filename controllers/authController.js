// controllers/authController.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { transporter, MAIL_FROM } = require('../config/mailer');
const { JWT_SECRET, STORE_MOUNT, NODE_ENV } = require('../config/env');
const { getAdminLoginHTML } = require('../views/adminLogin');

// GET /admin/login
exports.renderLogin = (_req, res) => {
    res.send(getAdminLoginHTML());
};

// POST /admin/request-code
exports.requestCode = async (req, res) => {
    let { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Ingresa un correo válido.' });
    email = String(email).toLowerCase().trim();

    try {
        const u = await pool.query(
            `SELECT id, activo, rol FROM usuarios WHERE LOWER(email) = $1`,
            [email]
        );
        if (u.rows.length === 0) return res.status(404).json({ error: 'Correo no registrado.' });
        if (!u.rows[0].activo) return res.status(403).json({ error: 'Usuario inactivo.' });
        if (u.rows[0].rol !== 'admin') return res.status(403).json({ error: 'Sin permisos de administración.' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiracion = Date.now() + 15 * 60 * 1000;

        await pool.query(
            `UPDATE usuarios SET codigo = $1, expiracion = $2 WHERE LOWER(email) = $3`,
            [code, expiracion, email]
        );

        await transporter.sendMail({
            from: MAIL_FROM,
            to: email,
            subject: 'Código de acceso — SIMEC Store Admin',
            html: `
                <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px;text-align:center">
                    <div style="background:#fff;max-width:500px;margin:0 auto;padding:30px;border-top:4px solid #D90000;border-radius:4px">
                        <h2 style="color:#333;margin-top:0">Acceso al panel</h2>
                        <p style="color:#555">Ingresa este código para acceder a SIMEC Store:</p>
                        <div style="background:#f9f9f9;border:1px dashed #ccc;padding:15px;margin:25px 0;font-size:32px;font-weight:bold;letter-spacing:5px;color:#D90000">${code}</div>
                        <p style="color:#777;font-size:12px">Válido por 15 minutos.</p>
                    </div>
                </div>
            `
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('requestCode:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
};

// POST /admin/login
exports.login = async (req, res) => {
    let { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Faltan datos.' });
    email = String(email).toLowerCase().trim();

    try {
        const q = await pool.query(
            `SELECT id, codigo, expiracion, activo, rol FROM usuarios WHERE LOWER(email) = $1`,
            [email]
        );
        if (q.rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado.' });
        const row = q.rows[0];
        if (!row.activo || row.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos.' });
        if (row.codigo !== code) return res.status(401).json({ error: 'Código incorrecto.' });
        if (!row.expiracion || Date.now() > Number(row.expiracion)) {
            return res.status(401).json({ error: 'Código expirado.' });
        }

        await pool.query(`UPDATE usuarios SET codigo = NULL, expiracion = NULL WHERE id = $1`, [row.id]);

        const token = jwt.sign({ email, uid: row.id, rol: row.rol }, JWT_SECRET, { expiresIn: '30d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: STORE_MOUNT,
        });
        res.json({ ok: true });
    } catch (err) {
        console.error('login:', err);
        res.status(500).json({ error: 'Error del servidor.' });
    }
};

// GET /admin/logout
exports.logout = (_req, res) => {
    res.clearCookie('token', { path: STORE_MOUNT });
    res.redirect(`${STORE_MOUNT}/admin/login`);
};
