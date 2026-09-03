// views/publicCategoria.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const {
    productGridHTML,
    breadcrumbsHTML,
    breadcrumbsJsonLd,
    paginacionHTML,
    cartCounterScript,
} = require('./publicComponents');

function getPublicCategoriaHTML({ categoria, productos, total, pagina, porPagina, orden }) {
    const url = `${STORE_MOUNT}/categoria/${escape(categoria.slug)}`;
    const canonical = `${BASE_URL}${url}${pagina > 1 ? `?p=${pagina}` : ''}`;

    const bc = [
        { href: STORE_MOUNT, label: 'Inicio' },
        { href: `${STORE_MOUNT}/categoria/todas`, label: 'Categorías' },
        { label: categoria.nombre },
    ];

    const body = `
        <div class="container">
            ${breadcrumbsHTML(bc)}

            <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:16px;margin:12px 0 20px">
                <div>
                    <h1 style="margin:0;font-size:26px;text-transform:uppercase;letter-spacing:1px">${escape(categoria.nombre)}</h1>
                    <div class="text-soft" style="font-size:12px;margin-top:6px">${total} producto${total === 1 ? '' : 's'}</div>
                </div>
                <form method="GET" action="${url}" style="display:flex;gap:8px;align-items:center">
                    <label class="text-soft" style="font-size:12px">Ordenar por:</label>
                    <select name="orden" class="select" style="min-width:180px" onchange="this.form.submit()">
                        <option value="reciente" ${orden === 'reciente' ? 'selected' : ''}>Más reciente</option>
                        <option value="precio_asc" ${orden === 'precio_asc' ? 'selected' : ''}>Precio: menor a mayor</option>
                        <option value="precio_desc" ${orden === 'precio_desc' ? 'selected' : ''}>Precio: mayor a menor</option>
                        <option value="nombre" ${orden === 'nombre' ? 'selected' : ''}>Nombre A-Z</option>
                    </select>
                </form>
            </div>

            ${categoria.descripcion ? `<p class="text-soft" style="max-width:800px;margin-bottom:24px">${escape(categoria.descripcion)}</p>` : ''}

            ${productGridHTML(productos)}
            ${paginacionHTML(total, pagina, porPagina, url + (orden !== 'reciente' ? '?orden=' + orden : ''))}
        </div>
        ${cartCounterScript()}
    `;

    const title = categoria.meta_title || `${categoria.nombre} — SIMEC Store`;
    const desc = categoria.meta_description || (categoria.descripcion || `${categoria.nombre} disponibles con entrega inmediata en SIMEC Store.`).slice(0, 320);

    return pageLayout({
        title, description: desc, canonical,
        jsonLd: breadcrumbsJsonLd(bc, BASE_URL),
    }, body);
}

function getPublicCategoriasIndexHTML(categorias) {
    // Agrupa por raíz (padre_id null)
    const byParent = new Map();
    categorias.forEach(c => {
        const k = c.padre_id || 0;
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(c);
    });

    const cardsHtml = (byParent.get(0) || []).map(c => {
        const hijas = categorias.filter(x => x.padre_id === c.id);
        return `
            <div class="panel">
                <a href="${STORE_MOUNT}/categoria/${escape(c.slug)}" style="color:#fff;text-decoration:none">
                    <h3 style="margin:0 0 6px;font-size:15px;text-transform:uppercase;letter-spacing:1px">${escape(c.nombre)}</h3>
                    <div class="text-soft" style="font-size:12px">${c.n_productos} producto${c.n_productos === 1 ? '' : 's'}</div>
                </a>
                ${hijas.length ? `<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
                    ${hijas.map(h => `<a href="${STORE_MOUNT}/categoria/${escape(h.slug)}" style="color:var(--text-mid);font-size:12px">↳ ${escape(h.nombre)} <span class="text-soft">(${h.n_productos})</span></a>`).join('')}
                </div>` : ''}
            </div>
        `;
    }).join('');

    const body = `
        <div class="container">
            ${breadcrumbsHTML([
                { href: STORE_MOUNT, label: 'Inicio' },
                { label: 'Categorías' },
            ])}
            <h1 style="text-transform:uppercase;letter-spacing:1px;font-size:22px;margin:12px 0 24px">Todas las categorías</h1>
            ${cardsHtml
                ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">${cardsHtml}</div>`
                : `<div class="empty-state"><h3>Aún no hay categorías publicadas</h3></div>`}
        </div>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: 'Categorías — SIMEC Store',
        description: 'Explora todas las categorías de componentes industriales SIMEC.',
        canonical: `${BASE_URL}${STORE_MOUNT}/categoria/todas`,
    }, body);
}

module.exports = { getPublicCategoriaHTML, getPublicCategoriasIndexHTML };
