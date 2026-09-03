// views/publicCarrito.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { fmtMoneda, breadcrumbsHTML, cartCounterScript } = require('./publicComponents');

function getPublicCarritoHTML({ items, totales }) {
    const rows = items.length ? items.map(it => `
        <tr data-id="${it.producto_id}">
            <td style="width:80px">
                ${it.prod.imagen_url
                    ? `<div style="width:70px;height:70px;background:#0d0d0d;border:1px solid var(--border)"><img src="${STORE_MOUNT}${escape(it.prod.imagen_url)}" style="width:100%;height:100%;object-fit:cover"></div>`
                    : ''}
            </td>
            <td>
                <a href="${STORE_MOUNT}/producto/${escape(it.prod.slug)}" style="color:#fff;font-weight:600">${escape(it.prod.nombre)}</a>
                <div class="text-soft" style="font-family:monospace;font-size:11px;margin-top:4px">${escape(it.prod.sku)}${it.prod.marca ? ' · ' + escape(it.prod.marca) : ''}</div>
                ${it.reserva_expira_en ? `<div class="reserva-timer" data-expira="${new Date(it.reserva_expira_en).toISOString()}" style="margin-top:6px;font-size:11px;color:var(--accent-gold);display:inline-flex;align-items:center;gap:6px"><span>⏱</span><span class="tval">Apartado</span></div>` : ''}
            </td>
            <td style="width:130px">
                <input type="number" class="input qty" min="1" value="${it.cantidad}" data-id="${it.producto_id}" style="text-align:center">
            </td>
            <td class="text-right" style="width:140px">${fmtMoneda(it.prod.precio_lista, it.prod.moneda)}</td>
            <td class="text-right" style="width:160px;font-weight:700;color:var(--primary-red)">${fmtMoneda(Number(it.prod.precio_lista) * it.cantidad, it.prod.moneda)}</td>
            <td class="text-right" style="width:60px">
                <button class="btn btn-ghost btn-sm" title="Quitar" onclick="quitar(${it.producto_id})">✕</button>
            </td>
        </tr>
    `).join('') : '';

    const body = `
        <div class="container">
            ${breadcrumbsHTML([
                { href: STORE_MOUNT, label: 'Inicio' },
                { label: 'Carrito' },
            ])}
            <h1 style="text-transform:uppercase;letter-spacing:1px;font-size:22px;margin:12px 0 20px">Tu carrito</h1>

            ${items.length ? `
            <div style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start">
                <div class="panel" style="padding:0;overflow:auto">
                    <table class="table" style="border:none">
                        <thead>
                            <tr>
                                <th></th><th>Producto</th><th>Cantidad</th>
                                <th class="text-right">Precio</th>
                                <th class="text-right">Importe</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div>
                    <div class="panel">
                        <div class="panel-title">Resumen</div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Subtotal</span><strong>${fmtMoneda(totales.subtotal, items[0]?.prod.moneda)}</strong></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:var(--text-soft)"><span>Envío</span><span>Se calcula al pagar</span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:var(--text-soft)"><span>IVA</span><span>Se calcula al pagar</span></div>
                        <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-size:16px"><span><strong>Total</strong></span><strong style="color:var(--primary-red)">${fmtMoneda(totales.total, items[0]?.prod.moneda)}</strong></div>
                        <a href="${STORE_MOUNT}/checkout" class="btn btn-red btn-block mt-4">Continuar al pago →</a>
                        <a href="${STORE_MOUNT}" class="btn btn-outline btn-block mt-2">Seguir comprando</a>
                        <button class="btn btn-ghost btn-block mt-2" onclick="vaciar()">Vaciar carrito</button>
                    </div>
                    <div class="text-soft mt-4" style="font-size:11px;text-align:center">Cada producto se aparta 15 min al agregarlo al carrito. Se renueva al editar la cantidad.</div>
                </div>
            </div>
            ` : `
            <div class="empty-state">
                <h3>Tu carrito está vacío</h3>
                <p>Agrega productos desde el catálogo y aquí verás el resumen.</p>
                <div class="mt-4"><a href="${STORE_MOUNT}" class="btn btn-red">Ver catálogo</a></div>
            </div>
            `}
        </div>

        <script>
            // ---------- Cuenta regresiva de reservas ----------
            function tickReservas() {
                document.querySelectorAll('.reserva-timer').forEach(el => {
                    const expira = new Date(el.dataset.expira).getTime();
                    const diff = expira - Date.now();
                    const val = el.querySelector('.tval');
                    if (diff <= 0) {
                        el.style.color = 'var(--primary-red)';
                        val.textContent = 'Reservación vencida — recarga';
                    } else {
                        const m = Math.floor(diff / 60000);
                        const s = Math.floor((diff % 60000) / 1000);
                        val.textContent = 'Apartado ' + m + ':' + String(s).padStart(2, '0');
                        if (diff < 3 * 60000) el.style.color = 'var(--primary-red)';
                    }
                });
            }
            tickReservas();
            setInterval(tickReservas, 1000);

            let timers = {};
            document.querySelectorAll('.qty').forEach(input => {
                input.addEventListener('input', (e) => {
                    const id = e.target.dataset.id;
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    clearTimeout(timers[id]);
                    timers[id] = setTimeout(async () => {
                        try {
                            const r = await fetch('${STORE_MOUNT}/api/carrito/actualizar', {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                credentials: 'same-origin',
                                body: JSON.stringify({ producto_id: parseInt(id, 10), cantidad: val })
                            });
                            const data = await r.json();
                            if (r.ok) { window.dispatchEvent(new Event('carrito:updated')); setTimeout(()=>location.reload(),300); }
                            else window.showToast(data.error || 'Error');
                        } catch (e) { window.showToast('Error de conexión'); }
                    }, 500);
                });
            });

            async function quitar(id) {
                try {
                    const r = await fetch('${STORE_MOUNT}/api/carrito/' + id, { method: 'DELETE', credentials: 'same-origin' });
                    if (r.ok) { window.dispatchEvent(new Event('carrito:updated')); setTimeout(()=>location.reload(),200); }
                    else window.showToast('Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }

            async function vaciar() {
                if (!confirm('¿Vaciar el carrito?')) return;
                try {
                    const r = await fetch('${STORE_MOUNT}/api/carrito', { method: 'DELETE', credentials: 'same-origin' });
                    if (r.ok) { window.dispatchEvent(new Event('carrito:updated')); setTimeout(()=>location.reload(),200); }
                    else window.showToast('Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }
        </script>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: 'Carrito — SIMEC Store',
        description: 'Revisa tu carrito de compras en SIMEC Store.',
        canonical: `${BASE_URL}${STORE_MOUNT}/carrito`,
        headExtra: '<meta name="robots" content="noindex,follow">',
    }, body);
}

module.exports = { getPublicCarritoHTML };
