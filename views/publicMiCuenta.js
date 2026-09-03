// views/publicMiCuenta.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { fmtMoneda, breadcrumbsHTML, cartCounterScript } = require('./publicComponents');

const ESTATUS = {
    pendiente_pago: { label: 'Pendiente de pago', color: 'var(--accent-gold)' },
    pagado: { label: 'Pagado', color: 'var(--accent-green)' },
    empacando: { label: 'Empacando', color: 'var(--accent-blue)' },
    enviado: { label: 'Enviado', color: 'var(--accent-blue)' },
    entregado: { label: 'Entregado', color: 'var(--accent-green)' },
    cancelado: { label: 'Cancelado', color: 'var(--text-soft)' },
};

function badge(estatus) {
    const s = ESTATUS[estatus] || { label: estatus, color: 'var(--text-soft)' };
    return `<span class="badge" style="background:${s.color}22;color:${s.color};border:1px solid ${s.color}66">${s.label}</span>`;
}

function fmtFecha(d) {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPublicMiCuentaHTML({ cliente, pedidos, direcciones }) {
    const pedidosHtml = pedidos.length ? `
        <div class="panel" style="padding:0;overflow:auto">
            <table class="table" style="border:none">
                <thead><tr><th>Folio</th><th>Fecha</th><th>Estatus</th><th class="text-right">Total</th><th></th></tr></thead>
                <tbody>${pedidos.map(p => `
                    <tr>
                        <td><a href="${STORE_MOUNT}/pedido/${escape(p.folio)}" style="color:#fff;font-family:monospace;font-weight:600">${escape(p.folio)}</a></td>
                        <td class="text-soft" style="font-size:12px">${escape(fmtFecha(p.creado_en))}</td>
                        <td>${badge(p.estatus)}</td>
                        <td class="text-right"><strong>${fmtMoneda(p.total, p.moneda)}</strong></td>
                        <td class="text-right">
                            <a href="${STORE_MOUNT}/pedido/${escape(p.folio)}" class="btn btn-outline btn-sm">Ver</a>
                            ${p.tracking_url ? `<a href="${escape(p.tracking_url)}" target="_blank" class="btn btn-outline btn-sm">Rastrear</a>` : ''}
                        </td>
                    </tr>
                `).join('')}</tbody>
            </table>
        </div>
    ` : `<div class="empty-state"><h3>Aún no tienes pedidos</h3><p>Cuando hagas tu primera compra, aparecerá aquí.</p><a href="${STORE_MOUNT}" class="btn btn-red mt-4">Ver catálogo</a></div>`;

    const direccionesHtml = direcciones.length ? direcciones.map(d => `
        <div class="panel" style="margin-bottom:12px">
            <div>${escape(d.calle)} ${escape(d.numero_ext || '')}${d.numero_int ? ' Int. ' + escape(d.numero_int) : ''}</div>
            <div class="text-soft" style="font-size:12px">${escape(d.colonia || '')} · CP ${escape(d.cp)}</div>
            <div class="text-soft" style="font-size:12px">${escape(d.municipio || '')}, ${escape(d.estado || '')}</div>
        </div>
    `).join('') : '<div class="text-soft" style="font-size:12px">Aún no tienes direcciones guardadas.</div>';

    const body = `
        <div class="container">
            ${breadcrumbsHTML([
                { href: STORE_MOUNT, label: 'Inicio' },
                { label: 'Mi cuenta' },
            ])}

            <div class="flex items-center justify-between" style="margin:12px 0 20px;flex-wrap:wrap;gap:12px">
                <div>
                    <h1 style="margin:0;font-size:22px;text-transform:uppercase;letter-spacing:1px">Hola, ${escape(cliente.nombre || cliente.email)}</h1>
                    <div class="text-soft mt-2" style="font-size:12px">${escape(cliente.email)}</div>
                </div>
                <button class="btn btn-outline" onclick="cerrarSesion()">Cerrar sesión</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start">
                <div>
                    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Mis pedidos</h2>
                    ${pedidosHtml}
                </div>
                <div>
                    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Direcciones</h2>
                    ${direccionesHtml}
                    <div class="text-soft mt-4" style="font-size:11px">Se guardan automáticamente cuando compras.</div>
                </div>
            </div>
        </div>

        <script>
            async function cerrarSesion() {
                await fetch('${STORE_MOUNT}/api/cliente/logout', { method: 'POST', credentials: 'same-origin' });
                window.location.href = '${STORE_MOUNT}';
            }
        </script>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: 'Mi cuenta — SIMEC Store',
        canonical: `${BASE_URL}${STORE_MOUNT}/mi-cuenta`,
        headExtra: '<meta name="robots" content="noindex,nofollow">',
    }, body);
}

function getPublicMiCuentaLoginHTML() {
    const body = `
        <div class="container-narrow" style="padding-top:32px;padding-bottom:60px">
            ${breadcrumbsHTML([
                { href: STORE_MOUNT, label: 'Inicio' },
                { label: 'Mi cuenta' },
            ])}
            <div class="panel" style="max-width:400px;margin:24px auto">
                <h2 style="margin:0 0 6px;font-size:16px;text-transform:uppercase;letter-spacing:1px;text-align:center">Entrar a mi cuenta</h2>
                <div class="text-soft" style="font-size:12px;text-align:center;margin-bottom:24px">Te enviaremos un código de 6 dígitos.</div>

                <form id="emailForm">
                    <div class="field">
                        <label>Correo</label>
                        <input type="email" id="emailInput" class="input" required autocomplete="email">
                    </div>
                    <button type="submit" class="btn btn-red btn-block" id="btn1">Enviar código</button>
                </form>

                <form id="codeForm" class="hidden">
                    <p class="text-soft" style="font-size:12px;text-align:center;margin:0 0 16px">Código enviado a <strong id="displayEmail" style="color:#fff"></strong></p>
                    <div class="field">
                        <label>Código de 6 dígitos</label>
                        <input type="text" id="codeInput" class="input" inputmode="numeric" maxlength="6" required style="text-align:center;letter-spacing:8px;font-size:18px">
                    </div>
                    <button type="submit" class="btn btn-red btn-block" id="btn2">Entrar</button>
                    <button type="button" class="btn btn-outline btn-block mt-2" onclick="volver()">Usar otro correo</button>
                </form>

                <div class="text-soft mt-4" style="font-size:11px;text-align:center;border-top:1px solid var(--border);padding-top:16px">
                    ¿Aún no tienes cuenta? Se crea automáticamente al finalizar tu primer pedido.
                </div>
            </div>
        </div>

        <script>
            let userEmail = '';
            const eForm = document.getElementById('emailForm');
            const cForm = document.getElementById('codeForm');
            const b1 = document.getElementById('btn1');
            const b2 = document.getElementById('btn2');

            eForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                userEmail = document.getElementById('emailInput').value.trim().toLowerCase();
                b1.classList.add('loading'); b1.textContent = 'Enviando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/cliente/request-code', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail })
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('Código enviado');
                        document.getElementById('displayEmail').textContent = userEmail;
                        eForm.classList.add('hidden'); cForm.classList.remove('hidden');
                        document.getElementById('codeInput').focus();
                    } else window.showToast(data.error || 'Error');
                } catch(err) { window.showToast('Error de conexión'); }
                finally { b1.classList.remove('loading'); b1.textContent = 'Enviar código'; }
            });

            cForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                b2.classList.add('loading'); b2.textContent = 'Verificando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/cliente/login', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ email: userEmail, code: document.getElementById('codeInput').value.trim() })
                    });
                    const data = await r.json();
                    if (r.ok) { window.showSuccess('Acceso concedido'); setTimeout(() => location.reload(), 400); }
                    else { window.showToast(data.error || 'Error'); b2.classList.remove('loading'); b2.textContent = 'Entrar'; }
                } catch(err) { window.showToast('Error de conexión'); b2.classList.remove('loading'); b2.textContent = 'Entrar'; }
            });

            function volver() { cForm.classList.add('hidden'); eForm.classList.remove('hidden'); document.getElementById('codeInput').value=''; }
        </script>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: 'Iniciar sesión — SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
    }, body);
}

module.exports = { getPublicMiCuentaHTML, getPublicMiCuentaLoginHTML };
