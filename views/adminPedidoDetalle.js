// views/adminPedidoDetalle.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

const ESTATUS = ['pendiente_pago', 'pagado', 'empacando', 'enviado', 'entregado', 'cancelado'];

function money(v, moneda) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(v) || 0);
}

function fmtFecha(d) {
    return new Date(d).toLocaleString('es-MX');
}

function getAdminPedidoDetalleHTML(user, p, opts = {}) {
    const dir = `${p.calle || ''} ${p.numero_ext || ''}${p.numero_int ? ' Int. ' + p.numero_int : ''}`;
    const receptor = p.cfdi_receptor || {};

    const itemsRows = p.items.map(it => `
        <tr>
            <td>
                <div>${escape(it.nombre_snapshot)}</div>
                <div class="text-soft" style="font-family:monospace;font-size:11px">${escape(it.sku_snapshot)}</div>
            </td>
            <td class="text-right">${it.cantidad}</td>
            <td class="text-right">${money(it.precio_unit, p.moneda)}</td>
            <td class="text-right"><strong>${money(it.precio_total, p.moneda)}</strong></td>
        </tr>
    `).join('');

    const estatusOpts = ESTATUS.map(e =>
        `<option value="${e}" ${p.estatus === e ? 'selected' : ''}>${e}</option>`
    ).join('');

    const facturaSection = (() => {
        if (!p.requiere_factura) {
            return `<div class="text-soft" style="font-size:12px">Este pedido no requiere factura.</div>`;
        }
        if (p.cfdi_id) {
            return `
                <div class="mt-2" style="font-size:12px">
                    <div><strong>UUID:</strong> <code style="font-size:11px">${escape(p.cfdi_uuid || p.cfdi_id)}</code></div>
                </div>
                <div class="flex gap-2 mt-4">
                    <a href="${STORE_MOUNT}/admin/pedidos/${p.id}/factura/pdf" class="btn btn-red btn-sm" target="_blank">Descargar PDF</a>
                    <a href="${STORE_MOUNT}/admin/pedidos/${p.id}/factura/xml" class="btn btn-outline btn-sm" target="_blank">Descargar XML</a>
                </div>
            `;
        }
        if (p.cfdi_error) {
            return `
                <div class="badge badge-out" style="display:block;padding:8px 10px;margin-bottom:8px">Error al facturar</div>
                <div class="text-soft" style="font-size:11px;white-space:pre-wrap;line-height:1.5">${escape(p.cfdi_error)}</div>
                <button class="btn btn-red btn-sm mt-4" onclick="regenerarFactura()" ${!opts.facturamaOk ? 'disabled title="Configura Facturama en .env"' : ''}>Reintentar factura</button>
            `;
        }
        return `
            <div class="badge badge-low-stock" style="display:block;padding:8px 10px">Pendiente de generar</div>
            <div class="text-soft mt-2" style="font-size:11px">La factura se genera automáticamente al confirmar el pago.</div>
            <button class="btn btn-red btn-sm mt-4" onclick="regenerarFactura()" ${!opts.facturamaOk ? 'disabled title="Configura Facturama en .env"' : ''}>Generar factura ahora</button>
        `;
    })();

    const body = `
        <div class="toolbar">
            <div>
                <h1 style="margin:0;font-family:monospace;font-size:22px">${escape(p.folio)}</h1>
                <div class="text-soft mt-2" style="font-size:12px">${escape(fmtFecha(p.creado_en))} · Estatus actual: <strong>${p.estatus}</strong></div>
            </div>
            <a href="${STORE_MOUNT}/admin/pedidos" class="btn btn-outline">← Volver</a>
        </div>

        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:start">
            <div class="stack">
                <!-- Items -->
                <div class="panel">
                    <div class="panel-title">Productos</div>
                    <table class="table" style="border:none">
                        <thead>
                            <tr><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">P. Unit</th><th class="text-right">Total</th></tr>
                        </thead>
                        <tbody>${itemsRows}</tbody>
                    </table>
                    <div style="margin-top:16px;text-align:right">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-soft">Subtotal</span><span>${money(p.subtotal, p.moneda)}</span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-soft">Envío</span><span>${money(p.envio, p.moneda)}</span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-soft">IVA</span><span>${money(p.iva, p.moneda)}</span></div>
                        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);font-size:16px;margin-top:8px">
                            <strong>Total</strong><strong style="color:var(--primary-red)">${money(p.total, p.moneda)}</strong>
                        </div>
                    </div>
                </div>

                <!-- Cliente / Envío -->
                <div class="panel">
                    <div class="panel-title">Cliente y envío</div>
                    <div class="field-row">
                        <div>
                            <div class="text-soft" style="font-size:11px;text-transform:uppercase">Cliente</div>
                            <div>${escape(p.cliente_nombre || '—')}</div>
                            <div class="text-soft" style="font-size:12px">${escape(p.email || '')}</div>
                            ${p.cliente_telefono ? `<div class="text-soft" style="font-size:12px">${escape(p.cliente_telefono)}</div>` : ''}
                        </div>
                        <div>
                            <div class="text-soft" style="font-size:11px;text-transform:uppercase">Dirección</div>
                            <div>${escape(dir)}</div>
                            <div class="text-soft" style="font-size:12px">${escape(p.colonia || '')} · CP ${escape(p.cp || '')}</div>
                            <div class="text-soft" style="font-size:12px">${escape(p.municipio || '')}, ${escape(p.estado || '')}</div>
                        </div>
                    </div>
                </div>

                <!-- Guía -->
                <div class="panel">
                    <div class="panel-title">Guía de envío</div>
                    <form id="guiaForm">
                        <div class="field-row">
                            <div class="field">
                                <label>Transportista</label>
                                <input type="text" name="transportista" class="input" value="${escape(p.transportista || '')}">
                            </div>
                            <div class="field">
                                <label>Servicio</label>
                                <input type="text" name="servicio_envio" class="input" value="${escape(p.servicio_envio || '')}">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field">
                                <label>Número de guía</label>
                                <input type="text" name="guia" class="input" value="${escape(p.guia || '')}">
                            </div>
                            <div class="field">
                                <label>URL de tracking</label>
                                <input type="url" name="tracking_url" class="input" value="${escape(p.tracking_url || '')}">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-red btn-sm">Guardar guía</button>
                    </form>
                </div>
            </div>

            <div class="stack">
                <!-- Estatus -->
                <div class="panel">
                    <div class="panel-title">Cambiar estatus</div>
                    <select id="estatusSel" class="select" onchange="cambiarEstatus(this.value)">
                        ${estatusOpts}
                    </select>
                    <div class="text-soft mt-2" style="font-size:11px">
                        Actualizado: ${escape(fmtFecha(p.actualizado_en))}
                    </div>
                </div>

                <!-- Pago -->
                <div class="panel">
                    <div class="panel-title">Pago</div>
                    ${p.mp_payment_id ? `
                        <div style="font-size:12px"><strong>Mercado Pago ID:</strong><br><code>${escape(p.mp_payment_id)}</code></div>
                        ${p.mp_payment_method ? `<div class="text-soft mt-2" style="font-size:12px">Método: ${escape(p.mp_payment_method)}</div>` : ''}
                    ` : '<div class="text-soft" style="font-size:12px">Aún no se registra pago.</div>'}
                </div>

                <!-- Facturación -->
                <div class="panel">
                    <div class="panel-title">Facturación CFDI 4.0</div>
                    ${p.requiere_factura ? `
                        <div style="font-size:12px;margin-bottom:8px">
                            <div><strong>${escape(receptor.razon_social || '—')}</strong></div>
                            <div class="text-soft">RFC: ${escape(receptor.rfc || '—')}</div>
                            <div class="text-soft">Uso: ${escape(receptor.uso_cfdi || '—')} · Régimen: ${escape(receptor.regimen || '—')} · CP: ${escape(receptor.cp_fiscal || '—')}</div>
                        </div>
                    ` : ''}
                    ${facturaSection}
                </div>

                <!-- Acciones -->
                <div class="panel">
                    <div class="panel-title">Acciones</div>
                    <button class="btn btn-outline btn-block" onclick="reenviarCorreo()">Reenviar correo al cliente</button>
                    <a href="${STORE_MOUNT}/pedido/${escape(p.folio)}" target="_blank" class="btn btn-outline btn-block mt-2">Ver como cliente ↗</a>
                </div>

                <!-- Notas -->
                ${p.notas ? `
                <div class="panel">
                    <div class="panel-title">Notas internas</div>
                    <div class="text-soft" style="font-size:12px;white-space:pre-wrap;line-height:1.6">${escape(p.notas)}</div>
                </div>` : ''}
            </div>
        </div>

        <script>
            async function post(url, method='POST', body=null) {
                const opts = { method, credentials: 'same-origin' };
                if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
                const r = await fetch(url, opts);
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || 'Error');
                return data;
            }

            async function cambiarEstatus(v) {
                try { await post('${STORE_MOUNT}/api/admin/pedidos/${p.id}/estatus', 'PUT', { estatus: v }); window.showSuccess('Estatus actualizado'); }
                catch(e){ window.showToast(e.message); }
            }
            async function regenerarFactura() {
                try {
                    window.showSuccess('Generando factura...');
                    await post('${STORE_MOUNT}/api/admin/pedidos/${p.id}/facturar');
                    window.showSuccess('Factura generada');
                    setTimeout(()=>location.reload(),600);
                } catch(e){ window.showToast(e.message); }
            }
            async function reenviarCorreo() {
                try { await post('${STORE_MOUNT}/api/admin/pedidos/${p.id}/reenviar-correo'); window.showSuccess('Correo reenviado'); }
                catch(e){ window.showToast(e.message); }
            }
            document.getElementById('guiaForm').addEventListener('submit', async e => {
                e.preventDefault();
                const fd = new FormData(e.target);
                try {
                    await post('${STORE_MOUNT}/api/admin/pedidos/${p.id}/guia', 'PUT', {
                        transportista: fd.get('transportista'),
                        servicio_envio: fd.get('servicio_envio'),
                        guia: fd.get('guia'),
                        tracking_url: fd.get('tracking_url'),
                    });
                    window.showSuccess('Guía guardada');
                } catch(err){ window.showToast(err.message); }
            });
        </script>
    `;

    return pageLayout({
        title: `${p.folio} — Admin SIMEC Store`,
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'pedidos',
    }, body);
}

module.exports = { getAdminPedidoDetalleHTML };
