// views/publicHome.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { productGridHTML, cartCounterScript } = require('./publicComponents');

function getPublicHomeHTML({ recientes, categorias }) {
    const catCards = categorias.map(c => `
        <a href="${STORE_MOUNT}/categoria/${escape(c.slug)}" class="cat-card">
            <div class="cat-name">${escape(c.nombre)}</div>
            <div class="cat-count">${c.n_productos} producto${c.n_productos === 1 ? '' : 's'}</div>
        </a>
    `).join('');

    const body = `
        <style>
            .hero { background: linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,.85)), url('https://simecautomation.com/wp-content/uploads/2021/08/slider-1.jpg') center/cover no-repeat; padding: 80px 20px; text-align: center; }
            .hero h1 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px; }
            .hero p { color: var(--text-mid); font-size: 15px; max-width: 640px; margin: 0 auto 28px; }
            .hero-search { max-width: 560px; margin: 0 auto; display: flex; gap: 0; background: #000; border: 1px solid var(--border-strong); }
            .hero-search input { flex: 1; padding: 14px 18px; background: transparent; border: none; color: #fff; font-size: 14px; }
            .hero-search input:focus { outline: none; }
            .hero-search button { padding: 14px 24px; background: var(--primary-red); color: #fff; border: none; font-weight: 700; text-transform: uppercase; font-size: 12px; cursor: pointer; letter-spacing: 1px; }
            .section { padding: 48px 0; }
            .section h2 { font-size: 22px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 24px; text-align: center; font-weight: 800; }
            .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
            .cat-card { background: var(--bg-panel); border: 1px solid var(--border); padding: 24px; text-align: center; transition: all .2s; }
            .cat-card:hover { border-color: var(--primary-red); transform: translateY(-2px); }
            .cat-name { font-weight: 700; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; }
            .cat-count { color: var(--text-soft); font-size: 12px; margin-top: 6px; }
            .trust { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; padding: 40px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: #050505; }
            .trust-item { text-align: center; padding: 0 20px; }
            .trust-item .icon { font-size: 28px; color: var(--primary-red); margin-bottom: 8px; }
            .trust-item h4 { margin: 4px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
            .trust-item p { color: var(--text-soft); font-size: 12px; margin: 0; }
        </style>

        <section class="hero">
            <div class="container">
                <h1>Componentes industriales<br>con entrega inmediata</h1>
                <p>Baleros, motores, sensores, neumática y más. Cotización de envío en tiempo real y facturación electrónica al momento.</p>
                <form class="hero-search" action="${STORE_MOUNT}/buscar" method="GET">
                    <input type="text" name="q" placeholder="Busca por número de parte, marca o descripción...">
                    <button type="submit">Buscar</button>
                </form>
            </div>
        </section>

        <div class="trust">
            <div class="trust-item"><div class="icon">🚚</div><h4>Envío nacional</h4><p>Cotización con DHL, FedEx, Estafeta y más</p></div>
            <div class="trust-item"><div class="icon">📦</div><h4>Entrega inmediata</h4><p>Solo mostramos lo que tenemos en almacén</p></div>
            <div class="trust-item"><div class="icon">🧾</div><h4>Facturación 4.0</h4><p>CFDI emitido al momento del pago</p></div>
            <div class="trust-item"><div class="icon">🛠️</div><h4>Soporte técnico</h4><p>Un ingeniero te ayuda a elegir la pieza correcta</p></div>
        </div>

        <section class="section">
            <div class="container">
                <h2>Explora por categoría</h2>
                ${categorias.length
                    ? `<div class="cat-grid">${catCards}</div>`
                    : `<div class="empty-state"><p>Aún no hay categorías publicadas.</p></div>`}
                <div style="text-align:center;margin-top:24px">
                    <a href="${STORE_MOUNT}/categoria/todas" class="btn btn-outline">Ver todas las categorías →</a>
                </div>
            </div>
        </section>

        <section class="section" style="border-top:1px solid var(--border);background:#060606">
            <div class="container">
                <h2>Productos recientes</h2>
                ${productGridHTML(recientes)}
                <div style="text-align:center;margin-top:24px">
                    <a href="${STORE_MOUNT}/categoria/todas" class="btn btn-red">Ver catálogo completo</a>
                </div>
            </div>
        </section>

        ${cartCounterScript()}
    `;

    return pageLayout({
        title: 'SIMEC Store — Componentes industriales con entrega inmediata',
        description: 'Tienda oficial SIMEC Automation. Baleros, motores, sensores y componentes industriales en stock, con envío a todo México y facturación electrónica CFDI 4.0.',
        canonical: `${BASE_URL}${STORE_MOUNT}`,
    }, body);
}

module.exports = { getPublicHomeHTML };
