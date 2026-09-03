// views/publicBusqueda.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { productGridHTML, breadcrumbsHTML, paginacionHTML, cartCounterScript } = require('./publicComponents');

function getPublicBusquedaHTML({ q, productos, total, pagina, porPagina }) {
    const url = `${STORE_MOUNT}/buscar?q=${encodeURIComponent(q)}`;
    const bc = [
        { href: STORE_MOUNT, label: 'Inicio' },
        { label: q ? `Búsqueda: "${q}"` : 'Búsqueda' },
    ];

    const body = `
        <div class="container">
            ${breadcrumbsHTML(bc)}
            <h1 style="text-transform:uppercase;letter-spacing:1px;font-size:22px;margin:12px 0 8px">
                ${q ? `Resultados para "${escape(q)}"` : 'Búsqueda'}
            </h1>
            <div class="text-soft" style="margin-bottom:20px">${total} resultado${total === 1 ? '' : 's'}</div>

            <form method="GET" action="${STORE_MOUNT}/buscar" style="max-width:600px;display:flex;gap:0;margin-bottom:24px">
                <input type="text" name="q" class="input" value="${escape(q)}" placeholder="Número de parte, marca, descripción..." style="border-right:none">
                <button type="submit" class="btn btn-red">Buscar</button>
            </form>

            ${productos.length
                ? productGridHTML(productos)
                : (q ? `<div class="empty-state">
                        <h3>No encontramos "${escape(q)}"</h3>
                        <p>Prueba con otra palabra, un número de parte más corto, o solicita cotización.</p>
                        <div class="mt-4"><a href="${STORE_MOUNT}/contacto" class="btn btn-red">Solicitar cotización</a></div>
                    </div>` : '')}
            ${paginacionHTML(total, pagina, porPagina, url)}
        </div>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: q ? `${q} — Búsqueda en SIMEC Store` : 'Buscar en SIMEC Store',
        description: q ? `Resultados de búsqueda para "${q}" en el catálogo de componentes industriales SIMEC.` : 'Busca componentes industriales por número de parte.',
        canonical: `${BASE_URL}${url}`,
        headExtra: q ? '' : '<meta name="robots" content="noindex,follow">',
    }, body);
}

module.exports = { getPublicBusquedaHTML };
