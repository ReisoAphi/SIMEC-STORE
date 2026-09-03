// views/publicProducto.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const {
    fmtMoneda,
    productGridHTML,
    breadcrumbsHTML,
    breadcrumbsJsonLd,
    cartCounterScript,
} = require('./publicComponents');

function getPublicProductoHTML({ producto, relacionados }) {
    const p = producto;
    const url = `${STORE_MOUNT}/producto/${escape(p.slug)}`;
    const canonical = `${BASE_URL}${url}`;

    const bc = [
        { href: STORE_MOUNT, label: 'Inicio' },
    ];
    if (p.padre_slug) bc.push({ href: `${STORE_MOUNT}/categoria/${escape(p.padre_slug)}`, label: p.padre_nombre });
    if (p.categoria_slug) bc.push({ href: `${STORE_MOUNT}/categoria/${escape(p.categoria_slug)}`, label: p.categoria_nombre });
    bc.push({ label: p.nombre });

    const conStock = p.stock > 0;
    const puedeCotizar = !conStock && p.permite_cotizacion !== false;

    const imagenes = p.imagenes && p.imagenes.length ? p.imagenes : [];
    const principal = imagenes[0];

    const gallery = imagenes.length ? `
        <div class="gallery">
            <div class="main-img">
                <img id="mainImg" src="${STORE_MOUNT}${escape(principal.url)}" alt="${escape(principal.alt || p.nombre)}">
            </div>
            ${imagenes.length > 1 ? `<div class="thumbs">
                ${imagenes.map((im, i) => `<div class="thumb ${i === 0 ? 'active' : ''}" onclick="setMain('${STORE_MOUNT}${escape(im.url)}', this)"><img src="${STORE_MOUNT}${escape(im.url)}" alt="${escape(im.alt || p.nombre)}"></div>`).join('')}
            </div>` : ''}
        </div>
    ` : `
        <div class="main-img" style="display:flex;align-items:center;justify-content:center;color:#333;font-size:12px;letter-spacing:2px;background:#0d0d0d">
            SIN IMAGEN
        </div>
    `;

    const especs = p.especificaciones || {};
    const especRows = Object.keys(especs).length
        ? `<table class="table" style="margin-top:16px">
             <tbody>
             ${Object.entries(especs).map(([k, v]) => `<tr><td class="text-soft" style="width:40%">${escape(k)}</td><td>${escape(v)}</td></tr>`).join('')}
             </tbody>
           </table>`
        : '';

    const oem = Array.isArray(p.oem_compatibles) ? p.oem_compatibles : [];
    const oemHtml = oem.length ? `
        <div class="panel mt-6">
            <div class="panel-title">Números de parte equivalentes / OEM</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${oem.map(o => `<span class="badge badge-out" style="font-family:monospace;text-transform:none">${escape(o)}</span>`).join('')}
            </div>
        </div>
    ` : '';

    // JSON-LD Product
    const availability = conStock
        ? 'https://schema.org/InStock'
        : (puedeCotizar ? 'https://schema.org/PreOrder' : 'https://schema.org/OutOfStock');

    const productJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.nombre,
        sku: p.sku,
        mpn: p.sku,
        image: imagenes.map(i => `${BASE_URL}${STORE_MOUNT}${i.url}`),
        description: p.descripcion_larga || p.descripcion_corta || p.nombre,
        brand: p.marca ? { '@type': 'Brand', name: p.marca } : undefined,
        category: p.categoria_nombre || undefined,
        offers: {
            '@type': 'Offer',
            url: canonical,
            priceCurrency: p.moneda || 'MXN',
            price: Number(p.precio_lista) || 0,
            availability,
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: 'SIMEC Automation' },
        },
    };

    const combinedJsonLd = [productJsonLd, breadcrumbsJsonLd(bc, BASE_URL)];

    const body = `
        <style>
            .prod-layout { display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; margin: 24px 0 40px; }
            @media (max-width: 900px) { .prod-layout { grid-template-columns: 1fr; } }
            .gallery { display: flex; flex-direction: column; gap: 12px; }
            .main-img { aspect-ratio: 1/1; background: #0d0d0d; border: 1px solid var(--border); overflow: hidden; }
            .main-img img { width: 100%; height: 100%; object-fit: contain; }
            .thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; }
            .thumb { aspect-ratio: 1/1; background: #0d0d0d; border: 1px solid var(--border); cursor: pointer; overflow: hidden; transition: border-color .2s; }
            .thumb.active, .thumb:hover { border-color: var(--primary-red); }
            .thumb img { width: 100%; height: 100%; object-fit: cover; }
            .prod-info h1 { margin: 0 0 8px; font-size: 26px; }
            .prod-sku { color: var(--text-soft); font-family: monospace; font-size: 13px; letter-spacing: 1px; }
            .price-block { display:flex;align-items:baseline;gap:12px;margin: 20px 0; }
            .price-big { font-size: 34px; font-weight: 800; color: var(--primary-red); }
            .price-iva { color: var(--text-soft); font-size: 12px; }
            .qty-row { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
            .qty-input { width: 90px; text-align: center; }
            .add-cart { flex: 1; }
            .stock-note { margin-top:10px;font-size:12px;color:var(--text-soft); }
            .prod-desc { color: var(--text-mid); line-height: 1.7; white-space: pre-wrap; }
        </style>

        <div class="container">
            ${breadcrumbsHTML(bc)}
            <div class="prod-layout">
                ${gallery}
                <div class="prod-info">
                    <div class="prod-sku">SKU: ${escape(p.sku)}${p.marca ? ' · ' + escape(p.marca) : ''}</div>
                    <h1>${escape(p.nombre)}</h1>
                    ${p.descripcion_corta ? `<p class="text-soft" style="line-height:1.6">${escape(p.descripcion_corta)}</p>` : ''}

                    <div class="price-block">
                        <div class="price-big">${fmtMoneda(p.precio_lista, p.moneda)}</div>
                        <div class="price-iva">${p.iva_incluido ? 'IVA incluido' : '+ IVA'}</div>
                    </div>

                    <div>
                        ${conStock
                            ? `<span class="badge badge-in-stock">✓ Entrega inmediata · ${p.stock} disponible${p.stock === 1 ? '' : 's'}</span>`
                            : (puedeCotizar
                                ? '<span class="badge badge-quote">Bajo pedido — sujeto a cotización</span>'
                                : '<span class="badge badge-out">No disponible</span>')}
                    </div>

                    ${conStock ? `
                    <div class="qty-row">
                        <label class="text-soft" style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Cantidad</label>
                        <input type="number" id="qtyInput" class="input qty-input" value="1" min="1" max="${p.stock}">
                        <button class="btn btn-red btn-lg add-cart" id="btnAdd">Agregar al carrito</button>
                    </div>
                    <div class="stock-note">Se aparta durante 15 min al agregar al carrito.</div>
                    ` : (puedeCotizar ? `
                    <div style="margin-top:20px">
                        <button class="btn btn-red btn-lg btn-block" onclick="abrirCotizar()">Solicitar cotización</button>
                        <div class="stock-note" style="text-align:center">Precio y disponibilidad sujetos a cotización según cantidad.</div>
                    </div>
                    ` : '')}

                    <div style="border-top:1px solid var(--border);margin-top:32px;padding-top:20px;color:var(--text-soft);font-size:12px;line-height:1.8">
                        🚚 Envío nacional cotizado al pagar (DHL, FedEx, Estafeta y más)<br>
                        🧾 Facturación electrónica CFDI 4.0 al momento del pago<br>
                        🛠️ Soporte técnico para elegir la pieza correcta
                    </div>
                </div>
            </div>

            ${p.descripcion_larga ? `
                <div class="panel mt-6">
                    <div class="panel-title">Descripción</div>
                    <div class="prod-desc">${escape(p.descripcion_larga)}</div>
                </div>` : ''}

            ${especRows ? `
                <div class="panel mt-6">
                    <div class="panel-title">Especificaciones técnicas</div>
                    ${especRows}
                </div>` : ''}

            ${oemHtml}

            ${relacionados.length ? `
                <div style="margin-top:60px">
                    <h2 style="text-align:center;font-size:20px;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px">También te puede interesar</h2>
                    ${productGridHTML(relacionados)}
                </div>` : ''}
        </div>

        <!-- Modal cotización -->
        <div class="modal-overlay" id="modalCot">
            <div class="modal-box">
                <h3>Solicitar cotización</h3>
                <p class="text-soft" style="font-size:12px;margin:-8px 0 16px">${escape(p.nombre)} · SKU ${escape(p.sku)}</p>
                <form id="cotForm">
                    <div class="field-row">
                        <div class="field">
                            <label>Cantidad</label>
                            <input type="number" id="cotCantidad" class="input" value="1" min="1" required>
                        </div>
                        <div class="field">
                            <label>CP destino (opcional)</label>
                            <input type="text" id="cotCP" class="input" maxlength="10">
                        </div>
                    </div>
                    <div class="field">
                        <label>Correo *</label>
                        <input type="email" id="cotEmail" class="input" required>
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label>Nombre</label>
                            <input type="text" id="cotNombre" class="input">
                        </div>
                        <div class="field">
                            <label>Teléfono</label>
                            <input type="tel" id="cotTel" class="input">
                        </div>
                    </div>
                    <div class="field">
                        <label>Empresa</label>
                        <input type="text" id="cotEmpresa" class="input">
                    </div>
                    <div class="field">
                        <label>Notas para el vendedor</label>
                        <textarea id="cotMensaje" class="textarea" rows="3" placeholder="Fecha requerida, número de piezas anual, aplicación..."></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="cerrarCotizar()">Cancelar</button>
                        <button type="submit" class="btn btn-red" id="btnCot">Enviar solicitud</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            function setMain(url, el) {
                document.getElementById('mainImg').src = url;
                document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                el.classList.add('active');
            }

            function abrirCotizar() { document.getElementById('modalCot').classList.add('open'); }
            function cerrarCotizar() { document.getElementById('modalCot').classList.remove('open'); }
            document.getElementById('modalCot').addEventListener('click', (e) => { if (e.target.id === 'modalCot') cerrarCotizar(); });

            ${conStock ? `
            document.getElementById('btnAdd').addEventListener('click', async () => {
                const cantidad = parseInt(document.getElementById('qtyInput').value, 10) || 1;
                const btn = document.getElementById('btnAdd');
                btn.classList.add('loading'); btn.textContent = 'Agregando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/carrito/agregar', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ producto_id: ${p.id}, cantidad })
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('Agregado al carrito');
                        window.dispatchEvent(new Event('carrito:updated'));
                    } else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = 'Agregar al carrito'; }
            });
            ` : ''}

            document.getElementById('cotForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnCot');
                btn.classList.add('loading'); btn.textContent = 'Enviando...';
                try {
                    const payload = {
                        producto_id: ${p.id},
                        cantidad: parseInt(document.getElementById('cotCantidad').value, 10) || 1,
                        cp: document.getElementById('cotCP').value,
                        email: document.getElementById('cotEmail').value.trim().toLowerCase(),
                        nombre: document.getElementById('cotNombre').value,
                        telefono: document.getElementById('cotTel').value,
                        empresa: document.getElementById('cotEmpresa').value,
                        mensaje: document.getElementById('cotMensaje').value,
                    };
                    const r = await fetch('${STORE_MOUNT}/api/cotizacion', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('Solicitud enviada (' + data.folio + ')');
                        cerrarCotizar();
                    } else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = 'Enviar solicitud'; }
            });

            // Stock live vía Socket.io
            (function() {
                try {
                    const script = document.createElement('script');
                    script.src = '${STORE_MOUNT}/socket.io/socket.io.js';
                    script.onload = function() {
                        const socket = io({ path: '${STORE_MOUNT}/socket.io' });
                        socket.on('connect', () => socket.emit('watch:producto', ${p.id}));
                        socket.on('stock:update', () => location.reload());
                        socket.on('stock:reserva', () => {/* opcional: recargar */});
                        socket.on('stock:libera', () => {/* opcional: recargar */});
                    };
                    document.head.appendChild(script);
                } catch(e) {}
            })();
        </script>

        ${cartCounterScript()}
    `;

    const metaTitle = p.meta_title || `${p.nombre} — SKU ${p.sku} | SIMEC Store`;
    const metaDesc = p.meta_description
        || (p.descripcion_corta || '').slice(0, 320)
        || `${p.nombre}${p.marca ? ' ' + p.marca : ''} disponible en SIMEC Store México. Precio, disponibilidad y envío inmediato.`;
    const ogImage = imagenes[0] ? `${BASE_URL}${STORE_MOUNT}${imagenes[0].url}` : undefined;

    return pageLayout({
        title: metaTitle,
        description: metaDesc,
        canonical,
        ogImage,
        jsonLd: combinedJsonLd,
    }, body);
}

module.exports = { getPublicProductoHTML };
