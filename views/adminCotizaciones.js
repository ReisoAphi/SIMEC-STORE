// views/adminCotizaciones.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

const ESTATUS = {
    nueva: { label: 'Nueva', color: 'var(--accent-gold)' },
    respondida: { label: 'Respondida', color: 'var(--accent-blue)' },
    convertida: { label: 'Convertida', color: 'var(--accent-green)' },
    rechazada: { label: 'Rechazada', color: 'var(--text-soft)' },
};

function badge(estatus) {
    const s = ESTATUS[estatus] || { label: estatus, color: 'var(--text-soft)' };
    return `<span class="badge" style="background:${s.color}22;color:${s.color};border:1px solid ${s.color}66">${s.label}</span>`;
}

function fmtFecha(d) {
    return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getAdminCotizacionesHTML(user, cots, filtros) {
    const estatusOpts = Object.keys(ESTATUS).map(k =>
        `<option value="${k}" ${filtros.estatus === k ? 'selected' : ''}>${ESTATUS[k].label}</option>`
    ).join('');

    const rows = cots.length ? cots.map(c => `
        <tr>
            <td><code style="font-size:11px">${escape(c.folio)}</code></td>
            <td class="text-soft" style="font-size:11px">${escape(fmtFecha(c.creado_en))}</td>
            <td>
                <div style="font-size:12px"><a href="mailto:${escape(c.cliente_email)}" style="color:var(--primary-red)">${escape(c.cliente_email)}</a></div>
                <div class="text-soft" style="font-size:11px">${escape(c.cliente_nombre || '')} ${c.cliente_empresa ? ' · ' + escape(c.cliente_empresa) : ''}</div>
            </td>
            <td>
                ${c.sku_snapshot ? `<div style="font-size:12px">${escape(c.nombre_snapshot || '')}</div><div class="text-soft" style="font-family:monospace;font-size:11px">${escape(c.sku_snapshot)} × ${c.cantidad || 1}</div>` : '<span class="text-soft">—</span>'}
            </td>
            <td>${badge(c.estatus)}</td>
            <td class="text-right">
                <button class="btn btn-red btn-sm" onclick='abrirResponder(${JSON.stringify(c).replace(/'/g, "&#39;")})'>Responder</button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="6"><div class="empty-state"><h3>Sin cotizaciones</h3></div></td></tr>`;

    const body = `
        <h1>Cotizaciones</h1>

        <form class="toolbar" method="GET" action="${STORE_MOUNT}/admin/cotizaciones" style="align-items:end">
            <div class="filters" style="flex:1">
                <div class="field" style="margin:0;min-width:220px">
                    <label>Buscar folio, correo o SKU</label>
                    <input type="text" name="q" class="input" value="${escape(filtros.q || '')}">
                </div>
                <div class="field" style="margin:0;min-width:160px">
                    <label>Estatus</label>
                    <select name="estatus" class="select"><option value="">Todos</option>${estatusOpts}</select>
                </div>
                <button type="submit" class="btn btn-outline">Filtrar</button>
                <a href="${STORE_MOUNT}/admin/cotizaciones" class="btn btn-ghost">Limpiar</a>
            </div>
        </form>

        <div class="panel" style="padding:0;overflow:auto">
            <table class="table" style="border:none">
                <thead>
                    <tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Estatus</th><th></th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <!-- Modal responder -->
        <div class="modal-overlay" id="modalResp">
            <div class="modal-box" style="max-width:640px">
                <h3>Responder cotización</h3>
                <div id="respInfo" class="text-soft" style="font-size:12px;margin:-8px 0 16px"></div>
                <div style="margin-bottom:16px">
                    <button type="button" class="btn btn-outline btn-sm" onclick="plantilla('disponible')">Plantilla: disponible</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="plantilla('agotado')">Plantilla: agotado</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="plantilla('mayoreo')">Plantilla: mayoreo</button>
                </div>
                <form id="respForm">
                    <div class="field-row">
                        <div class="field">
                            <label>Precio unitario (MXN)</label>
                            <input type="number" id="respPrecio" class="input" step="0.01" min="0">
                        </div>
                        <div class="field">
                            <label>Tiempo de entrega</label>
                            <input type="text" id="respTiempo" class="input" placeholder="Ej: 7-10 días hábiles">
                        </div>
                    </div>
                    <div class="field">
                        <label>Mensaje al cliente *</label>
                        <textarea id="respMensaje" class="textarea" rows="6" required placeholder="Hola [nombre], respondiendo a tu solicitud..."></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modalResp').classList.remove('open')">Cancelar</button>
                        <button type="submit" class="btn btn-red" id="btnResp">Enviar respuesta</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            let cotSel = null;
            function abrirResponder(c) {
                cotSel = c;
                document.getElementById('respInfo').innerHTML =
                    'Folio <code>' + c.folio + '</code> · ' + c.cliente_email +
                    (c.sku_snapshot ? ' · Producto: ' + c.nombre_snapshot + ' (' + c.sku_snapshot + ')' : '');
                document.getElementById('respPrecio').value = '';
                document.getElementById('respTiempo').value = '';
                document.getElementById('respMensaje').value = '';
                document.getElementById('modalResp').classList.add('open');
            }

            function plantilla(tipo) {
                const nombre = cotSel?.cliente_nombre || 'estimado cliente';
                const prod = cotSel?.nombre_snapshot ? ' del ' + cotSel.nombre_snapshot + (cotSel.sku_snapshot ? ' (' + cotSel.sku_snapshot + ')' : '') : '';
                const cant = cotSel?.cantidad || 1;
                const templates = {
                    disponible: 'Hola ' + nombre + ',\\n\\nTenemos disponibilidad' + prod + ' para ' + cant + ' pieza(s). El precio unitario está indicado y el envío se cotiza al pagar.\\n\\nSi te parece bien, respóndenos y te generamos el pedido con la liga de pago.\\n\\nSaludos.',
                    agotado: 'Hola ' + nombre + ',\\n\\nEn este momento no tenemos existencia' + prod + '. El tiempo de reposición estimado es de 3-4 semanas.\\n\\nSi te interesa que te avisemos cuando esté disponible o si prefieres una alternativa equivalente, respóndenos por este medio.\\n\\nSaludos.',
                    mayoreo: 'Hola ' + nombre + ',\\n\\nGracias por tu interés. Para volúmenes' + prod + ' podemos ofrecerte precio especial. Te confirmamos el importe unitario y tiempo de entrega abajo.\\n\\nQuedamos atentos para procesar la orden.\\n\\nSaludos.'
                };
                document.getElementById('respMensaje').value = templates[tipo];
            }

            document.getElementById('respForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnResp');
                btn.classList.add('loading'); btn.textContent = 'Enviando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/cotizaciones/' + cotSel.id + '/responder', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            mensaje: document.getElementById('respMensaje').value,
                            precio: document.getElementById('respPrecio').value || null,
                            tiempo_entrega: document.getElementById('respTiempo').value,
                        })
                    });
                    const data = await r.json();
                    if (r.ok) { window.showSuccess('Respuesta enviada'); setTimeout(()=>location.reload(),400); }
                    else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = 'Enviar respuesta'; }
            });
            document.getElementById('modalResp').addEventListener('click', (e) => { if (e.target.id === 'modalResp') e.target.classList.remove('open'); });
        </script>
    `;

    return pageLayout({
        title: 'Cotizaciones — Admin SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'cotizaciones',
    }, body);
}

module.exports = { getAdminCotizacionesHTML };
