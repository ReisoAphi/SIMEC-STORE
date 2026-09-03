// views/publicPedido.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { fmtMoneda, breadcrumbsHTML, cartCounterScript } = require('./publicComponents');

function estatusBadge(estatus) {
    const map = {
        pendiente_pago: ['badge-quote', 'Pendiente de pago'],
        pagado: ['badge-in-stock', '✓ Pagado'],
        empacando: ['badge-low-stock', 'Empacando'],
        enviado: ['badge-quote', 'Enviado'],
        entregado: ['badge-in-stock', '✓ Entregado'],
        cancelado: ['badge-out', 'Cancelado'],
    };
    const [cls, label] = map[estatus] || ['badge-out', estatus];
    return `<span class="badge ${cls}" style="font-size:12px;padding:6px 12px">${label}</span>`;
}

function getPublicPedidoHTML({ pedido, estatusQuery }) {
    const itemsRows = pedido.items.map(it => `
        <tr>
            <td>
                <div>${escape(it.nombre_snapshot)}</div>
                <div class="text-soft" style="font-family:monospace;font-size:11px">${escape(it.sku_snapshot)}</div>
            </td>
            <td class="text-right">${it.cantidad}</td>
            <td class="text-right">${fmtMoneda(it.precio_unit, pedido.moneda)}</td>
            <td class="text-right"><strong>${fmtMoneda(it.precio_total, pedido.moneda)}</strong></td>
        </tr>
    `).join('');

    let banner = '';
    if (estatusQuery === 'aprobado') {
        banner = `<div style="background:rgba(40,167,69,.15);border:1px solid rgba(40,167,69,.4);color:var(--accent-green);padding:14px 18px;margin-bottom:20px">
            <strong>✓ Pago aprobado</strong> — recibirás tu confirmación por correo en breve.
        </div>`;
    } else if (estatusQuery === 'pendiente') {
        banner = `<div style="background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.4);color:var(--accent-gold);padding:14px 18px;margin-bottom:20px">
            <strong>⏱ Pago pendiente</strong> — si pagaste con SPEI u OXXO, tu pedido se confirmará cuando el banco lo procese.
        </div>`;
    } else if (estatusQuery === 'rechazado') {
        banner = `<div style="background:rgba(217,0,0,.15);border:1px solid rgba(217,0,0,.4);color:var(--primary-red);padding:14px 18px;margin-bottom:20px">
            <strong>✗ Pago rechazado</strong> — intenta con otro método o contáctanos.
        </div>`;
    }

    const dir = `${pedido.calle || ''} ${pedido.numero_ext || ''}${pedido.numero_int ? ' Int. ' + pedido.numero_int : ''}`;

    const body = `
        <div class="container-narrow">
            ${breadcrumbsHTML([
                { href: STORE_MOUNT, label: 'Inicio' },
                { label: `Pedido ${pedido.folio}` },
            ])}
            ${banner}

            <div class="panel">
                <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:12px">
                    <div>
                        <div class="panel-title" style="margin:0 0 4px">Pedido</div>
                        <h1 style="margin:0;font-size:20px;font-family:monospace">${escape(pedido.folio)}</h1>
                    </div>
                    ${estatusBadge(pedido.estatus)}
                </div>
                <div class="text-soft mt-2" style="font-size:12px">Fecha: ${new Date(pedido.creado_en).toLocaleString('es-MX')}</div>
            </div>

            <div class="panel mt-4">
                <div class="panel-title">Productos</div>
                <table class="table" style="border:none">
                    <thead>
                        <tr><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">P. Unit</th><th class="text-right">Importe</th></tr>
                    </thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <div style="margin-top:16px;text-align:right">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-soft">Subtotal</span><span>${fmtMoneda(pedido.subtotal, pedido.moneda)}</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-soft">Envío</span><span>${fmtMoneda(pedido.envio, pedido.moneda)}</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-soft">IVA</span><span>${fmtMoneda(pedido.iva, pedido.moneda)}</span></div>
                    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);font-size:16px;margin-top:8px">
                        <strong>Total</strong><strong style="color:var(--primary-red)">${fmtMoneda(pedido.total, pedido.moneda)}</strong>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
                <div class="panel">
                    <div class="panel-title">Envío</div>
                    <div><strong>${escape(pedido.cliente_nombre || '')}</strong></div>
                    <div class="text-soft" style="font-size:12px;line-height:1.6">
                        ${escape(dir)}<br>
                        ${escape(pedido.colonia || '')}${pedido.colonia ? ', ' : ''}CP ${escape(pedido.cp || '')}<br>
                        ${escape(pedido.municipio || '')}, ${escape(pedido.estado || '')}
                    </div>
                    ${pedido.transportista ? `<div class="mt-4" style="font-size:12px"><strong>${escape(pedido.transportista)}</strong> · ${escape(pedido.servicio_envio || '')}</div>` : ''}
                    ${pedido.guia ? `<div class="mt-2" style="font-size:12px">Guía: <code>${escape(pedido.guia)}</code></div>` : ''}
                    ${pedido.tracking_url ? `<a href="${escape(pedido.tracking_url)}" target="_blank" class="btn btn-outline btn-sm mt-4">Rastrear envío ↗</a>` : ''}
                </div>
                <div class="panel">
                    <div class="panel-title">Facturación</div>
                    ${pedido.requiere_factura ? `
                        ${pedido.cfdi_url_pdf ? `<a href="${escape(pedido.cfdi_url_pdf)}" target="_blank" class="btn btn-outline">Descargar PDF</a>` : ''}
                        ${pedido.cfdi_url_xml ? `<a href="${escape(pedido.cfdi_url_xml)}" target="_blank" class="btn btn-outline mt-2">Descargar XML</a>` : ''}
                        ${!pedido.cfdi_url_pdf ? `<div class="text-soft" style="font-size:12px">Factura en proceso, te llegará por correo cuando el pago se confirme.</div>` : ''}
                    ` : `<div class="text-soft" style="font-size:12px">Este pedido no requiere factura CFDI.</div>`}
                </div>
            </div>

            ${pedido.estatus === 'pendiente_pago' ? `
                <div class="panel mt-4" style="text-align:center;border-color:var(--accent-gold)">
                    <p>Tu pago aún no se ha completado.</p>
                    <p class="text-soft" style="font-size:12px">Si pagaste con OXXO o SPEI, tu pedido se confirmará automáticamente cuando el banco procese la transacción (normalmente 24-72h).</p>
                </div>` : ''}

            <div style="text-align:center;margin-top:32px">
                <a href="${STORE_MOUNT}" class="btn btn-outline">← Volver a la tienda</a>
            </div>
        </div>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: `Pedido ${pedido.folio} — SIMEC Store`,
        description: `Estatus del pedido ${pedido.folio}`,
        canonical: `${BASE_URL}${STORE_MOUNT}/pedido/${pedido.folio}`,
        headExtra: '<meta name="robots" content="noindex,nofollow">',
    }, body);
}

module.exports = { getPublicPedidoHTML };
