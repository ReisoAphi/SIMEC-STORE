// app.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const { PORT, STORE_MOUNT } = require('./config/env');
const { inicializarBaseDeDatos } = require('./config/database');
const { sessionMiddleware } = require('./utils/session');
const { iniciarLiberacionReservas } = require('./cron/liberarReservas');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

// Timeouts largos para subida de imágenes en cPanel
server.setTimeout(0);
server.keepAliveTimeout = 0;

// --- Aseguramos que existan carpetas de assets/uploads ---
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const uploadsProductsDir = path.join(uploadsDir, 'products');
for (const d of [publicDir, uploadsDir, uploadsProductsDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// --- Socket.io (para actualizaciones de stock en vivo) ---
const io = new Server(server, { path: `${STORE_MOUNT}/socket.io` });
app.set('io', io);
io.on('connection', (socket) => {
    socket.on('watch:producto', (productoId) => {
        if (Number.isInteger(productoId)) socket.join(`producto:${productoId}`);
    });
});

// --- BD + Cron ---
inicializarBaseDeDatos()
    .then(() => iniciarLiberacionReservas(io))
    .catch(err => console.error('No se pudo inicializar la BD:', err));

// --- Middlewares globales ---
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// --- Archivos estáticos ---
app.use(`${STORE_MOUNT}/public`, express.static(publicDir, { maxAge: '30d' }));
app.use(`${STORE_MOUNT}/uploads`, express.static(uploadsDir, { maxAge: '30d' }));

// --- Sesión pública (cookie sid para carrito) ---
app.use(STORE_MOUNT, sessionMiddleware);

// --- Redirect raíz ---
app.get('/', (_req, res) => res.redirect(STORE_MOUNT));

// --- Rutas principales ---
app.use(STORE_MOUNT, routes);

// --- 404 ---
app.use((req, res) => {
    res.status(404).send('No encontrado');
});

server.listen(PORT, () => {
    console.log(`🛒 SIMEC Store escuchando en puerto ${PORT} — montado en ${STORE_MOUNT}`);
});
