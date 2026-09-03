// controllers/clientesController.js
// Cuenta de cliente basada en código email (mismo patrón que admin, sin contraseña).
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { transporter, MAIL_FROM } = require('../config/mailer');
const { JWT_SECRET, STORE_MOUNT, BASE_URL, NODE_ENV } = require('../config/env');
const { getPublicMiCuentaHTML, getPublicMiCuentaLoginHTML } = require('../views/publicMiCuenta');

const COOKIE_NAME = 'ctoken';

// ---------- Helpers ----------
function readClienteToken(req) {
    const t = req.cookies && req.cookies[COOKIE_NAME];
    if (!t) return null;
    try { return jwt.verify(t, JWT_SECRET); } catch { return null; }
}

async function getClienteBySession(req) {
    const decoded = readClienteToken(req);
    if (!decoded || !decoded.cid) return null;
    const q = await pool.query(
        `SELECT id, email, nombre, telefono, es_empresa, razon_social, rfc, cuenta_activa
           FROM clientes WHERE id = $1`,
        [decoded.cid]
    );
    if (q.rows.length === 0 || !q.rows[0].cuenta_activa) return null;
    return q.rows[0];
}

// GET /api/cliente/me — para prefill del checkout / header
exports.me = async (req, res) => {
    const c = await getClienteBySession(req);
    if (!c) return res.status(401).json({ ok: false });

    // Última dirección para prefill de envío
    const dir = await pool.query(
        `SELECT calle, numero_ext, numero_int, colonia, municipio, estado, cp, referencias
           FROM direcciones WHERE cliente_id = $1 ORDER BY id DESC LIMIT 1`,
        [c.id]
    );
    res.json({ ok: true, cliente: c, direccion: dir.rows[0] || null });
};

// POST /api/cliente/existe { email } — checkout usa esto para ofrecer login
exports.existe = async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) return res.json({ existe: false });
    const q = await pool.query(
        `SELECT 1 FROM clientes WHERE LOWER(email) = $1 AND cuenta_activa = TRUE`,
        [email]
    );
    res.json({ existe: q.rows.length > 0 });
};

// POST /api/cliente/request-code { email }
exports.requestCode = async (req, res) => {
    let email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Correo inválido.' });

    // Si no tiene cuenta activa, se lo decimos claramente
    const c = await pool.query(
        `SELECT id, cuenta_activa FROM clientes WHERE LOWER(email) = $1`,
        [email]
    );
    if (c.rows.length === 0 || !c.rows[0].cuenta_activa) {
        return res.status(404).json({ error: 'No hay cuenta activa con ese correo. Crea una al pagar tu próximo pedido.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = Date.now() + 15 * 60 * 1000;
    await pool.query(
        `UPDATE clientes SET codigo=$1, expiracion=$2 WHERE id=$3`,
        [code, expiracion, c.rows[0].id]
    );

    try {
        await transporter.sendMail({
            from: MAIL_FROM, to: email,
            subject: 'Tu código de acceso — SIMEC Store',
            html: `
                <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px;text-align:center">
                    <div style="background:#fff;max-width:500px;margin:0 auto;padding:30px;border-top:4px solid #D90000">
                        <h2 style="color:#333;margin-top:0">Acceso a tu cuenta</h2>
                        <p style="color:#555">Usa este código para entrar a SIMEC Store:</p>
                        <div style="background:#f9f9f9;border:1px dashed #ccc;padding:15px;margin:25px 0;font-size:32px;font-weight:bold;letter-spacing:5px;color:#D90000">${code}</div>
                        <p style="color:#777;font-size:12px">Válido por 15 minutos. Si no fuiste tú, ignora este correo.</p>
                    </div>
                </div>
            `
        });
    } catch (err) {
        console.warn('cliente.requestCode mail:', err.message);
        return res.status(500).json({ error: 'No se pudo enviar el código. Intenta de nuevo.' });
    }

    res.json({ ok: true });
};

// POST /api/cliente/login { email, code }
exports.login = async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const code = String(req.body?.code || '').trim();
    if (!email || !code) return res.status(400).json({ error: 'Faltan datos.' });

    const q = await pool.query(
        `SELECT id, codigo, expiracion, cuenta_activa FROM clientes WHERE LOWER(email) = $1`,
        [email]
    );
    if (q.rows.length === 0) return res.status(401).json({ error: 'Cuenta no encontrada.' });
    const c = q.rows[0];
    if (!c.cuenta_activa) return res.status(403).json({ error: 'Cuenta inactiva.' });
    if (c.codigo !== code) return res.status(401).json({ error: 'Código incorrecto.' });
    if (!c.expiracion || Date.now() > Number(c.expiracion)) return res.status(401).json({ error: 'Código expirado.' });

    await pool.query(`UPDATE clientes SET codigo=NULL, expiracion=NULL WHERE id=$1`, [c.id]);
    const token = jwt.sign({ cid: c.id, email }, JWT_SECRET, { expiresIn: '90d' });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        path: STORE_MOUNT,
    });
    res.json({ ok: true });
};

// POST /api/cliente/logout
exports.logout = (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: STORE_MOUNT });
    res.json({ ok: true });
};

// GET /mi-cuenta
exports.miCuentaPage = async (req, res) => {
    const c = await getClienteBySession(req);
    if (!c) return res.send(getPublicMiCuentaLoginHTML());

    const [pedidos, direcciones] = await Promise.all([
        pool.query(`
            SELECT id, folio, estatus, total, moneda, creado_en, guia, tracking_url
              FROM pedidos WHERE cliente_id = $1 ORDER BY creado_en DESC LIMIT 50
        `, [c.id]),
        pool.query(`
            SELECT id, calle, numero_ext, numero_int, colonia, municipio, estado, cp
              FROM direcciones WHERE cliente_id = $1 ORDER BY id DESC
        `, [c.id]),
    ]);

    res.send(getPublicMiCuentaHTML({ cliente: c, pedidos: pedidos.rows, direcciones: direcciones.rows }));
};

// Utilidad exportada — checkout la usa para saber si viene un cliente logueado
module.exports.getClienteBySession = getClienteBySession;
module.exports.readClienteToken = readClienteToken;
module.exports.me = exports.me;
module.exports.existe = exports.existe;
module.exports.requestCode = exports.requestCode;
module.exports.login = exports.login;
module.exports.logout = exports.logout;
module.exports.miCuentaPage = exports.miCuentaPage;
