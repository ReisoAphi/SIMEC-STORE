// views/publicComponents.js
// Componentes reutilizables entre vistas públicas (tarjeta de producto, breadcrumbs,
// paginación, etc.).
const { escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function fmtMoneda(n, moneda = 'MXN') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(n) || 0);
}

function stockPill(p) {
    if (p.stock <= 0) {
        return p.permite_cotizacion !== false
            ? '<span class="badge badge-quote">Bajo pedido</span>'
            : '<span class="badge badge-out">No disponible</span>';
    }
    if (p.stock <= 3) return `<span class="badge badge-low-stock">Últimas ${p.stock}</span>`;
    return `<span class="badge badge-in-stock">Entrega inmediata</span>`;
}

function productCardHTML(p) {
    const url = `${STORE_MOUNT}/producto/${escape(p.slug)}`;
    return `
    <a class="product-card" href="${url}" title="${escape(p.nombre)}">
        <div class="thumb">
            ${p.imagen_url
                ? `<img src="${STORE_MOUNT}${escape(p.imagen_url)}" alt="${escape(p.imagen_alt || p.nombre)}" loading="lazy">`
                : `<span style="color:#333;font-size:11px;letter-spacing:2px">SIN IMAGEN</span>`}
        </div>
        <div class="body">
            <div class="sku">${escape(p.sku)}${p.marca ? ' · ' + escape(p.marca) : ''}</div>
            <div class="title">${escape(p.nombre)}</div>
            <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div class="price">${fmtMoneda(p.precio_lista, p.moneda)}</div>
                ${stockPill(p)}
            </div>
        </div>
    </a>`;
}

function productGridHTML(productos) {
    if (!productos.length) {
        return `<div class="empty-state"><h3>No hay productos</h3><p>Prueba ajustando el filtro o vuelve más tarde.</p></div>`;
    }
    return `<div class="product-grid">${productos.map(productCardHTML).join('')}</div>`;
}

function breadcrumbsHTML(items) {
    // items: [{ href, label }]
    return `
        <nav class="breadcrumbs" style="font-size:12px;color:var(--text-soft);margin:16px 0" aria-label="Breadcrumb">
            ${items.map((it, i) => {
                const sep = i > 0 ? '<span style="margin:0 8px">/</span>' : '';
                return sep + (it.href
                    ? `<a href="${it.href}" style="color:var(--text-mid)">${escape(it.label)}</a>`
                    : `<span style="color:#fff">${escape(it.label)}</span>`);
            }).join('')}
        </nav>
    `;
}

function breadcrumbsJsonLd(items, baseUrl) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.label,
            item: it.href ? (baseUrl + it.href) : undefined,
        })).filter(Boolean),
    };
}

function paginacionHTML(total, pagina, porPagina, baseUrl) {
    const nPag = Math.max(1, Math.ceil(total / porPagina));
    if (nPag <= 1) return '';
    const link = (p, label, disabled = false, activo = false) =>
        disabled
            ? `<span class="btn btn-outline btn-sm" style="opacity:.4;pointer-events:none">${label}</span>`
            : `<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}p=${p}" class="btn btn-outline btn-sm" ${activo ? 'style="border-color:var(--primary-red);color:#fff"' : ''}>${label}</a>`;

    const pages = [];
    for (let i = 1; i <= nPag; i++) {
        if (i === 1 || i === nPag || (i >= pagina - 2 && i <= pagina + 2)) {
            pages.push(link(i, String(i), false, i === pagina));
        } else if (pages[pages.length - 1] !== '…') {
            pages.push('…');
        }
    }

    return `
        <div class="flex gap-2 items-center" style="justify-content:center;flex-wrap:wrap;margin-top:32px">
            ${link(pagina - 1, '← Anterior', pagina <= 1)}
            ${pages.map(p => p === '…' ? '<span class="text-soft">…</span>' : p).join('')}
            ${link(pagina + 1, 'Siguiente →', pagina >= nPag)}
        </div>
    `;
}

// Script global para el mini-carrito del header y estado de cuenta:
// - Actualiza el badge del carrito
// - Cambia "Iniciar sesión" por "Mi cuenta" si hay sesión de cliente activa
// - Escucha eventos 'carrito:updated' y 'cliente:updated' para re-sincronizar
function cartCounterScript() {
    return `
        <script>
            (async function() {
                async function refreshCart() {
                    try {
                        const r = await fetch('${STORE_MOUNT}/api/carrito', { credentials: 'same-origin' });
                        if (!r.ok) return;
                        const data = await r.json();
                        const el = document.getElementById('cart-count');
                        if (el) el.textContent = data.count || 0;
                    } catch (e) {}
                }
                async function refreshAccount() {
                    try {
                        const r = await fetch('${STORE_MOUNT}/api/cliente/me', { credentials: 'same-origin' });
                        const el = document.getElementById('account-link');
                        if (!el) return;
                        if (r.ok) {
                            const data = await r.json();
                            el.textContent = 'Mi cuenta';
                            el.title = data.cliente?.email || '';
                        }
                    } catch (e) {}
                }
                window.__refreshCart = refreshCart;
                window.__refreshAccount = refreshAccount;
                window.addEventListener('carrito:updated', refreshCart);
                window.addEventListener('cliente:updated', refreshAccount);
                refreshCart();
                refreshAccount();
            })();
        </script>
    `;
}

module.exports = {
    fmtMoneda,
    stockPill,
    productCardHTML,
    productGridHTML,
    breadcrumbsHTML,
    breadcrumbsJsonLd,
    paginacionHTML,
    cartCounterScript,
};
