// config/env.js
require('dotenv').config();

const num = (v, def) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
};

const bool = (v, def = false) => {
    if (v === undefined || v === null || v === '') return def;
    return String(v).toLowerCase() === 'true' || v === '1';
};

module.exports = {
    PORT: num(process.env.PORT, 4100),
    NODE_ENV: process.env.NODE_ENV || 'development',
    BASE_URL: process.env.BASE_URL || 'http://localhost:4100',
    STORE_MOUNT: process.env.STORE_MOUNT || '/tienda',

    JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
    SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase(),

    DB_CONFIG: {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: num(process.env.DB_PORT, 5432),
    },

    SMTP: {
        host: process.env.SMTP_HOST,
        port: num(process.env.SMTP_PORT, 465),
        secure: bool(process.env.SMTP_SECURE, true),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.MAIL_FROM || 'SIMEC Tienda <noreply@simecautomation.com>',
        salesInbox: process.env.MAIL_SALES_INBOX || 'ventas@simecautomation.com',
    },

    SKYDROPX: {
        baseUrl: process.env.SKYDROPX_BASE_URL || 'https://api.skydropx.com/v1',
        apiKey: process.env.SKYDROPX_API_KEY,
        clientId: process.env.SKYDROPX_CLIENT_ID,
        clientSecret: process.env.SKYDROPX_CLIENT_SECRET,
    },

    MP: {
        accessToken: process.env.MP_ACCESS_TOKEN,
        publicKey: process.env.MP_PUBLIC_KEY,
        webhookSecret: process.env.MP_WEBHOOK_SECRET,
    },

    FACTURAMA: {
        baseUrl: process.env.FACTURAMA_BASE_URL || 'https://api.facturama.mx',
        user: process.env.FACTURAMA_USER,
        pass: process.env.FACTURAMA_PASS,
        emisorRfc: process.env.EMISOR_RFC,
        emisorRegimen: process.env.EMISOR_REGIMEN_FISCAL || '601',
        emisorLugarExpedicion: process.env.EMISOR_LUGAR_EXPEDICION,
    },

    ORIGEN: {
        cp: process.env.ORIGEN_CP || '66600',
        estado: process.env.ORIGEN_ESTADO || 'Nuevo León',
        ciudad: process.env.ORIGEN_CIUDAD || 'Apodaca',
    },
};
