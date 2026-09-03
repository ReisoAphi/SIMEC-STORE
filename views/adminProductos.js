// views/adminProductos.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function fmtDinero(v, moneda = 'MXN') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN', minimumFractionDigits: 2 }).format(v || 0);
}

function stockBadge(n) {
    if (n <= 0) return '<span class="badge badge-quote">Cotizar</span>';
    if (n <= 3) return `<span class="badge badge-low-stock">${n} disp.</span>`;
    return `<span class="badge badge-in-stock">${n} disp.</span>`;
}

function getAdminProductosHTML(user, productos, categorias, filtros) {
    const catOpts = categorias.map(c =>
        `<option value="${c.id}" ${String(filtros.categoria) === String(c.id) ? 'selected' : ''}>${escape(c.nombre)}</option>`
    ).join('');

    const rows = productos.length ? productos.map(p => `
        <tr>
            <td style="width:56px">
                ${p.imagen_principal
                    ? `<div style="width:44px;height:44px;background:#0d0d0d;border:1px solid var(--border)"><img src="${STORE_MOUNT}${escape(p.imagen_principal)}" style="width:100%;height:100%;object-fit:cover" alt=""></div>`
                    : `<div style="width:44px;height:44px;background:#0d0d0d;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:#333;font-size:10px">SIN IMG</div>`
                }
            </td>
            <td>
                <div><strong>${escape(p.nombre)}</strong></div>
                <div class="text-soft" style="font-size:11px;font-family:monospace">${escape(p.sku)}${p.marca ? ' · ' + escape(p.marca) : ''}</div>
            </td>
            <td>${p.categoria_nombre ? escape(p.categoria_nombre) : '<span class="text-soft">—</span>'}</td>
            <td>${fmtDinero(p.precio_lista, p.moneda)}</td>
            <td>${stockBadge(p.stock)}</td>
            <td>${p.activo ? '<span class="badge badge-in-stock">Activo</span>' : '<span class="badge badge-out">Inactivo</span>'}</td>
            <td class="text-right">
                <div class="row-actions" style="justify-content:flex-end">
                    <a href="${STORE_MOUNT}/admin/productos/${p.id}/editar" class="btn btn-outline btn-sm">Editar</a>
                    <button class="btn btn-outline btn-sm" onclick="borrar(${p.id}, '${escape(p.nombre).replace(/'/g,"\\'")}')">Borrar</button>
                </div>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="7"><div class="empty-state"><h3>Aún no hay productos</h3><p>Empieza dando de alta tu primer producto. Recuerda cargar buenas fotos y una descripción rica para SEO.</p><a href="${STORE_MOUNT}/admin/productos/nuevo" class="btn btn-red mt-4">+ Nuevo producto</a></div></td></tr>`;

    const body = `
        <div class="toolbar">
            <h1 style="margin:0">Productos</h1>
            <a href="${STORE_MOUNT}/admin/productos/nuevo" class="btn btn-red">+ Nuevo producto</a>
        </div>

        <form class="toolbar" method="GET" action="${STORE_MOUNT}/admin/productos" style="align-items:end">
            <div class="filters" style="flex:1">
                <div class="field" style="margin:0;flex:1;min-width:200px">
                    <label>Buscar por SKU, nombre o marca</label>
                    <input type="text" name="q" class="input" value="${escape(filtros.q || '')}" placeholder="6203-2RS, balero, SKF...">
                </div>
                <div class="field" style="margin:0;min-width:200px">
                    <label>Categoría</label>
                    <select name="categoria" class="select">
                        <option value="">— Todas —</option>
                        ${catOpts}
                    </select>
                </div>
                <div class="field" style="margin:0;min-width:160px">
                    <label>Estatus</label>
                    <select name="filtro" class="select">
                        <option value="" ${!filtros.filtro ? 'selected' : ''}>Todos</option>
                        <option value="activos" ${filtros.filtro === 'activos' ? 'selected' : ''}>Solo activos</option>
                        <option value="inactivos" ${filtros.filtro === 'inactivos' ? 'selected' : ''}>Solo inactivos</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-outline">Filtrar</button>
                <a href="${STORE_MOUNT}/admin/productos" class="btn btn-ghost">Limpiar</a>
            </div>
        </form>

        <div class="panel" style="padding:0;overflow:hidden">
            <table class="table" style="border:none">
                <thead>
                    <tr>
                        <th></th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th>Stock</th>
                        <th>Estatus</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <script>
            async function borrar(id, nombre) {
                if (!confirm('¿Eliminar el producto "' + nombre + '"?\\n\\nSi ya tiene pedidos asociados, se marcará como inactivo en lugar de borrar.')) return;
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/productos/' + id, { method: 'DELETE' });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess(data.softDelete ? 'Marcado como inactivo' : 'Eliminado');
                        setTimeout(() => location.reload(), 400);
                    } else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }
        </script>
    `;

    return pageLayout({
        title: 'Productos — Admin SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'productos',
    }, body);
}

module.exports = { getAdminProductosHTML };
