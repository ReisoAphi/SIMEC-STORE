// views/adminPedidos.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

const ESTATUS = {
    pendiente_pago: { label: 'Pendiente', color: 'var(--accent-gold)' },
    pagado:         { label: 'Pagado',    color: 'var(--accent-green)' },
    empacando:      { label: 'Empacando', color: 'var(--accent-blue)' },
    enviado:        { label: 'Enviado',   color: 'var(--accent-blue)' },
    entregado:      { label: 'Entregado', color: 'var(--accent-green)' },
    cancelado:      { label: 'Cancelado', color: 'var(--text-soft)' },
};

function money(v, moneda) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(v) || 0);
}

function badge(estatus) {
    const s = ESTATUS[estatus] || { label: estatus, color: 'var(--text-soft)' };
    return `<span class="badge" style="background:${s.color}22;color:${s.color};border:1px solid ${s.color}66">${s.label}</span>`;
}

function fmtFecha(d) {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getAdminPedidosHTML(user, pedidos, filtros) {
    const estatusOpts = Object.keys(ESTATUS).map(k =>
        `<option value="${k}" ${filtros.estatus === k ? 'selected' : ''}>${ESTATUS[k].label}</option>`
    ).join('');

    const rows = pedidos.length ? pedidos.map(p => `
        <tr>
            <td><a href="${STORE_MOUNT}/admin/pedidos/${p.id}" style="color:#fff;font-family:monospace;font-weight:600">${escape(p.folio)}</a></td>
            <td class="text-soft" style="font-size:12px">${escape(fmtFecha(p.creado_en))}</td>
            <td>
                <div style="font-size:12px">${escape(p.cliente_nombre || '—')}</div>
                <div class="text-soft" style="font-size:11px">${escape(p.email || '')}</div>
            </td>
            <td>${badge(p.estatus)}</td>
            <td class="text-right"><strong>${money(p.total, p.moneda)}</strong></td>
            <td>${p.cfdi_id ? '<span class="badge badge-in-stock" title="Facturado">CFDI</span>' : (p.requiere_factura ? '<span class="badge badge-low-stock" title="Pendiente">…</span>' : '<span class="text-soft" style="font-size:11px">—</span>')}</td>
            <td>${p.guia ? `<code style="font-size:10px">${escape(p.guia)}</code>` : '<span class="text-soft">—</span>'}</td>
            <td class="text-right">
                <a href="${STORE_MOUNT}/admin/pedidos/${p.id}" class="btn btn-outline btn-sm">Abrir</a>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="8"><div class="empty-state"><h3>Sin pedidos</h3><p>Aún no hay pedidos que coincidan con el filtro.</p></div></td></tr>`;

    const body = `
        <h1>Pedidos</h1>

        <form class="toolbar" method="GET" action="${STORE_MOUNT}/admin/pedidos" style="align-items:end">
            <div class="filters" style="flex:1">
                <div class="field" style="margin:0;min-width:200px">
                    <label>Buscar folio / cliente</label>
                    <input type="text" name="q" class="input" value="${escape(filtros.q || '')}" placeholder="PED-... o email">
                </div>
                <div class="field" style="margin:0;min-width:160px">
                    <label>Estatus</label>
                    <select name="estatus" class="select"><option value="">Todos</option>${estatusOpts}</select>
                </div>
                <div class="field" style="margin:0">
                    <label>Desde</label>
                    <input type="date" name="desde" class="input" value="${escape(filtros.desde || '')}">
                </div>
                <div class="field" style="margin:0">
                    <label>Hasta</label>
                    <input type="date" name="hasta" class="input" value="${escape(filtros.hasta || '')}">
                </div>
                <button type="submit" class="btn btn-outline">Filtrar</button>
                <a href="${STORE_MOUNT}/admin/pedidos" class="btn btn-ghost">Limpiar</a>
            </div>
        </form>

        <div class="panel" style="padding:0;overflow:auto">
            <table class="table" style="border:none">
                <thead>
                    <tr>
                        <th>Folio</th><th>Fecha</th><th>Cliente</th>
                        <th>Estatus</th><th class="text-right">Total</th>
                        <th>Factura</th><th>Guía</th><th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <p class="text-soft mt-4" style="font-size:12px">Los pedidos aparecen automáticamente al confirmar el pago. Muestra hasta 200 registros — filtra por fecha para navegar catálogos más grandes.</p>
    `;
    return pageLayout({
        title: 'Pedidos — Admin SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'pedidos',
    }, body);
}

module.exports = { getAdminPedidosHTML };
