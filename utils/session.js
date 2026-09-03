// utils/session.js
// Middleware muy ligero: garantiza una cookie 'sid' persistente para
// identificar al visitante en carrito, reservas y cotizaciones anónimas.
const { randomUUID } = require('crypto');
const { STORE_MOUNT, NODE_ENV } = require('../config/env');

function sessionMiddleware(req, res, next) {
    let sid = req.cookies && req.cookies.sid;
    if (!sid) {
        sid = randomUUID();
        res.cookie('sid', sid, {
            httpOnly: true,
            sameSite: 'lax',
            secure: NODE_ENV === 'production',
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 año
            path: STORE_MOUNT,
        });
    }
    req.sesionId = sid;
    next();
}

module.exports = { sessionMiddleware };
