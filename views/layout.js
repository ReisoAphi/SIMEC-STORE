// views/layout.js
// Envoltura base para todas las páginas (pública y admin).
const { simecStoreStyles, toastMarkup } = require('./styles');
const { STORE_MOUNT, BASE_URL } = require('../config/env');

function escape(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
}

function publicHeader() {
    return `
        <header class="simec-header">
            <a href="${STORE_MOUNT}" class="brand">
                <span class="logo-red">SIMEC</span><span>STORE</span>
            </a>
            <nav>
                <a href="${STORE_MOUNT}">Catálogo</a>
                <a href="${STORE_MOUNT}/categoria/todas">Categorías</a>
                <a href="${STORE_MOUNT}/contacto">Contacto</a>
            </nav>
            <div class="actions">
                <a href="${STORE_MOUNT}/mi-cuenta" id="account-link" class="btn btn-outline btn-sm">Iniciar sesión</a>
                <a href="${STORE_MOUNT}/carrito" class="btn btn-outline btn-sm">Carrito <span id="cart-count" style="margin-left:6px;color:var(--primary-red);font-weight:800">0</span></a>
            </div>
        </header>
    `;
}

function adminHeader(user) {
    return `
        <header class="simec-header">
            <a href="${STORE_MOUNT}/admin" class="brand">
                <span class="logo-red">SIMEC</span><span>ADMIN</span>
            </a>
            <nav>
                <a href="${STORE_MOUNT}" target="_blank">Ver tienda ↗</a>
            </nav>
            <div class="actions">
                <span class="text-soft" style="font-size:12px">${escape(user?.email || '')}</span>
                <a href="${STORE_MOUNT}/admin/logout" class="btn btn-outline btn-sm">Salir</a>
            </div>
        </header>
    `;
}

function adminSidebar(activo) {
    const link = (href, label, key) =>
        `<a href="${STORE_MOUNT}${href}" class="${activo === key ? 'active' : ''}">${label}</a>`;
    return `
        <aside class="admin-sidebar">
            <div class="group">Catálogo</div>
            ${link('/admin/productos', 'Productos', 'productos')}
            ${link('/admin/categorias', 'Categorías', 'categorias')}
            ${link('/admin/inventario', 'Inventario', 'inventario')}
            <div class="group">Ventas</div>
            ${link('/admin/pedidos', 'Pedidos', 'pedidos')}
            ${link('/admin/cotizaciones', 'Cotizaciones', 'cotizaciones')}
            <div class="group">Configuración</div>
            ${link('/admin/usuarios', 'Usuarios', 'usuarios')}
            ${link('/admin/almacenes', 'Almacenes', 'almacenes')}
        </aside>
    `;
}

function publicFooter() {
    return `
        <footer class="simec-footer">
            <div class="container">
                <div>© ${new Date().getFullYear()} SIMEC Automation — Todos los derechos reservados.</div>
                <div style="margin-top:8px">
                    <a href="${STORE_MOUNT}/aviso-privacidad">Aviso de privacidad</a> ·
                    <a href="${STORE_MOUNT}/terminos">Términos y condiciones</a> ·
                    <a href="${STORE_MOUNT}/devoluciones">Política de devoluciones</a>
                </div>
            </div>
        </footer>
    `;
}

/**
 * Envuelve una página completa.
 * opts: { title, description, canonical, ogImage, jsonLd, headExtra, bodyClass, admin, user, sidebarActive }
 */
function pageLayout(opts, body) {
    const {
        title = 'SIMEC Store',
        description = 'Tienda oficial de componentes industriales SIMEC Automation.',
        canonical,
        ogImage,
        jsonLd,
        headExtra = '',
        bodyClass = '',
        admin = false,
        user = null,
        sidebarActive = null,
    } = opts || {};

    const canonicalUrl = canonical || `${BASE_URL}${STORE_MOUNT}`;
    const ogImg = ogImage || `${BASE_URL}${STORE_MOUNT}/public/og-default.jpg`;

    const jsonLdTag = jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
        : '';

    const header = admin ? adminHeader(user) : publicHeader();
    const wrap = admin
        ? `<div class="admin-shell">${adminSidebar(sidebarActive)}<main class="admin-main">${body}</main></div>`
        : body;
    const footer = admin ? '' : publicFooter();

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escape(title)}">
    <meta property="og:description" content="${escape(description)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImg}">
    <meta property="og:site_name" content="SIMEC Store">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" type="image/png" href="${STORE_MOUNT}/public/favicon.png">
    ${simecStoreStyles}
    ${headExtra}
    ${jsonLdTag}
</head>
<body class="${bodyClass}">
    ${header}
    ${wrap}
    ${footer}
    ${toastMarkup}
</body>
</html>`;
}

module.exports = { pageLayout, escape };
