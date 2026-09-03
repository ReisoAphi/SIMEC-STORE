// middleware/auth.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET, STORE_MOUNT } = require('../config/env');
const { pool } = require('../config/database');

function readSession(req) {
    const token = req.cookies && req.cookies.token;
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

async function requireAdmin(req, res, next) {
    const session = readSession(req);
    if (!session || !session.email) {
        return res.redirect(`${STORE_MOUNT}/admin/login`);
    }
    const email = session.email.toLowerCase();
    const q = await pool.query(
        `SELECT id, email, nombre, rol, activo FROM usuarios WHERE LOWER(email) = $1`,
        [email]
    );
    if (q.rows.length === 0 || !q.rows[0].activo || q.rows[0].rol !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }
    req.adminUser = q.rows[0];
    next();
}

async function requireAdminApi(req, res, next) {
    const session = readSession(req);
    if (!session || !session.email) return res.status(401).json({ error: 'No autorizado' });
    const q = await pool.query(
        `SELECT id, email, nombre, rol, activo FROM usuarios WHERE LOWER(email) = $1`,
        [session.email.toLowerCase()]
    );
    if (q.rows.length === 0 || !q.rows[0].activo || q.rows[0].rol !== 'admin') {
        return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    req.adminUser = q.rows[0];
    next();
}

module.exports = { readSession, requireAdmin, requireAdminApi };
