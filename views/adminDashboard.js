// views/adminDashboard.js
const { pageLayout } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function getAdminDashboardHTML(user, stats = {}) {
    const {
        totalProductos = 0,
        totalActivos = 0,
        totalCategorias = 0,
        pedidosPendientes = 0,
        cotizacionesNuevas = 0,
        stockBajo = 0,
    } = stats;

    const card = (label, value, href, color = 'var(--primary-red)') => `
        <a href="${STORE_MOUNT}${href}" class="panel" style="display:block;text-decoration:none;transition:border-color .2s" onmouseover="this.style.borderColor='${color}'" onmouseout="this.style.borderColor='var(--border)'">
            <div class="panel-title" style="margin:0 0 6px">${label}</div>
            <div style="font-size:32px;font-weight:800;color:${color}">${value}</div>
        </a>
    `;

    const body = `
        <h1>Panel de administración</h1>
        <p class="text-soft">Bienvenido, ${user.nombre || user.email}. Aquí un resumen rápido de la tienda.</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:24px">
            ${card('Productos', totalProductos, '/admin/productos')}
            ${card('Productos activos', totalActivos, '/admin/productos?filtro=activos', 'var(--accent-green)')}
            ${card('Categorías', totalCategorias, '/admin/categorias', 'var(--accent-blue)')}
            ${card('Pedidos pendientes', pedidosPendientes, '/admin/pedidos?estatus=pendiente_pago', 'var(--accent-gold)')}
            ${card('Cotizaciones nuevas', cotizacionesNuevas, '/admin/cotizaciones?estatus=nueva', 'var(--accent-gold)')}
            ${card('SKUs con stock bajo', stockBajo, '/admin/inventario?filtro=bajo', 'var(--primary-red)')}
        </div>

        <div class="panel mt-6">
            <div class="panel-title">Siguientes pasos recomendados</div>
            <ol style="margin:0;padding-left:20px;color:var(--text-mid);line-height:1.9">
                <li>Crea tus primeras <a href="${STORE_MOUNT}/admin/categorias" style="color:var(--primary-red)">categorías</a> (baleros, motores, sensores, etc.)</li>
                <li>Da de alta tus <a href="${STORE_MOUNT}/admin/productos" style="color:var(--primary-red)">productos</a> con SKU, fotos y descripción rica para SEO.</li>
                <li>Ajusta el <a href="${STORE_MOUNT}/admin/inventario" style="color:var(--primary-red)">inventario inicial</a> por almacén.</li>
                <li>Configura credenciales de <span class="text-soft">Mercado Pago, Skydropx y Facturama</span> en el archivo <code>.env</code>.</li>
                <li>Publica la tienda: <a href="${STORE_MOUNT}" target="_blank" style="color:var(--primary-red)">${STORE_MOUNT}</a></li>
            </ol>
        </div>
    `;

    return pageLayout({
        title: 'Admin — SIMEC Store',
        description: 'Panel de administración',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true,
        user,
        sidebarActive: null,
    }, body);
}

module.exports = { getAdminDashboardHTML };
