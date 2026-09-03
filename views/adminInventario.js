// views/adminInventario.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function stockCell(n) {
    if (n <= 0) return `<span class="badge badge-out">Sin stock</span>`;
    if (n <= 3) return `<span class="badge badge-low-stock">${n}</span>`;
    return `<span class="badge badge-in-stock">${n}</span>`;
}

function motivoLabel(m) {
    const map = {
        compra: 'Compra / Recepción',
        venta: 'Venta',
        merma: 'Merma',
        ajuste: 'Ajuste',
        devolucion: 'Devolución',
        traspaso: 'Traspaso',
    };
    return map[m] || m;
}

function getAdminInventarioHTML(user, productos, almacenes, filtros) {
    const rows = productos.length ? productos.map(p => {
        const almHtml = (p.por_almacen || []).map(a =>
            `<div style="display:flex;justify-content:space-between;font-size:12px;gap:10px">
                <span class="text-soft">${escape(a.almacen_nombre)}</span>
                <span>${stockCell(a.disponible)}</span>
            </div>`
        ).join('');
        return `
        <tr>
            <td>
                <div><strong>${escape(p.nombre)}</strong></div>
                <div class="text-soft" style="font-size:11px;font-family:monospace">${escape(p.sku)}${p.marca ? ' · ' + escape(p.marca) : ''}</div>
            </td>
            <td>${stockCell(p.stock_total)}</td>
            <td>${p.reservado_total > 0 ? `<span class="text-soft">${p.reservado_total}</span>` : '<span class="text-soft">—</span>'}</td>
            <td>${almHtml}</td>
            <td class="text-right">
                <div class="row-actions" style="justify-content:flex-end">
                    <button class="btn btn-red btn-sm" onclick='abrirAjuste(${JSON.stringify({id:p.id, sku:p.sku, nombre:p.nombre, por_almacen:p.por_almacen}).replace(/'/g,"&#39;")})'>Ajustar</button>
                    <a href="${STORE_MOUNT}/admin/inventario/${p.id}/historial" class="btn btn-outline btn-sm">Historial</a>
                </div>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5"><div class="empty-state"><h3>Sin resultados</h3><p>No hay productos que coincidan con el filtro.</p></div></td></tr>`;

    const body = `
        <h1>Inventario</h1>

        <form class="toolbar" method="GET" action="${STORE_MOUNT}/admin/inventario" style="align-items:end">
            <div class="filters" style="flex:1">
                <div class="field" style="margin:0;flex:1;min-width:200px">
                    <label>Buscar por SKU o nombre</label>
                    <input type="text" name="q" class="input" value="${escape(filtros.q || '')}" placeholder="6203, balero...">
                </div>
                <div class="field" style="margin:0;min-width:180px">
                    <label>Filtro</label>
                    <select name="filtro" class="select">
                        <option value="" ${!filtros.filtro ? 'selected' : ''}>Todos</option>
                        <option value="bajo" ${filtros.filtro === 'bajo' ? 'selected' : ''}>Stock bajo (≤ 3)</option>
                        <option value="cero" ${filtros.filtro === 'cero' ? 'selected' : ''}>Sin stock</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-outline">Aplicar</button>
                <a href="${STORE_MOUNT}/admin/inventario" class="btn btn-ghost">Limpiar</a>
            </div>
        </form>

        <div class="panel" style="padding:0;overflow:hidden">
            <table class="table" style="border:none">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Disponible</th>
                        <th>Reservado</th>
                        <th>Por almacén</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <!-- Modal ajuste -->
        <div class="modal-overlay" id="modalAj">
            <div class="modal-box">
                <h3>Ajustar inventario</h3>
                <div class="text-soft" id="ajProdInfo" style="margin-bottom:16px;font-size:12px"></div>
                <form id="ajForm">
                    <input type="hidden" id="ajProd">
                    <div class="field">
                        <label>Almacén</label>
                        <select id="ajAlmacen" class="select" required></select>
                    </div>
                    <div class="field">
                        <label>Motivo</label>
                        <select id="ajMotivo" class="select" required>
                            <option value="compra">Compra / Recepción (+)</option>
                            <option value="ajuste">Ajuste manual</option>
                            <option value="merma">Merma (−)</option>
                            <option value="devolucion">Devolución de cliente (+)</option>
                            <option value="traspaso">Traspaso entre almacenes</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>Cantidad (usa negativo para restar)</label>
                        <input type="number" id="ajDelta" class="input" required placeholder="Ej: 10 para agregar, -2 para restar">
                    </div>
                    <div class="field">
                        <label>Referencia (opcional)</label>
                        <input type="text" id="ajRef" class="input" maxlength="120" placeholder="Ej: OC-1024, factura 456...">
                    </div>
                    <div class="field">
                        <label>Notas (opcional)</label>
                        <textarea id="ajNotas" class="textarea" rows="2"></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAj').classList.remove('open')">Cancelar</button>
                        <button type="submit" class="btn btn-red" id="btnAj">Aplicar ajuste</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            const almacenesData = ${JSON.stringify(almacenes)};

            function abrirAjuste(p) {
                document.getElementById('ajProd').value = p.id;
                document.getElementById('ajProdInfo').innerHTML =
                    '<strong>' + p.nombre + '</strong><br>SKU: <code>' + p.sku + '</code>';
                const sel = document.getElementById('ajAlmacen');
                sel.innerHTML = almacenesData.map(a => {
                    const inv = (p.por_almacen || []).find(x => x.almacen_id === a.id);
                    const dispo = inv ? inv.disponible : 0;
                    return '<option value="' + a.id + '">' + a.nombre + ' — disponible: ' + dispo + '</option>';
                }).join('');
                document.getElementById('ajMotivo').value = 'compra';
                document.getElementById('ajDelta').value = '';
                document.getElementById('ajRef').value = '';
                document.getElementById('ajNotas').value = '';
                document.getElementById('modalAj').classList.add('open');
            }

            document.getElementById('ajForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnAj');
                btn.classList.add('loading'); btn.textContent = 'Aplicando...';
                const payload = {
                    producto_id: document.getElementById('ajProd').value,
                    almacen_id: document.getElementById('ajAlmacen').value,
                    delta: parseInt(document.getElementById('ajDelta').value, 10),
                    motivo: document.getElementById('ajMotivo').value,
                    referencia: document.getElementById('ajRef').value,
                    notas: document.getElementById('ajNotas').value,
                };
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/inventario/ajustar', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) { window.showSuccess('Nuevo stock: ' + data.stock); setTimeout(() => location.reload(), 500); }
                    else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = 'Aplicar ajuste'; }
            });

            document.getElementById('modalAj').addEventListener('click', (e) => {
                if (e.target.id === 'modalAj') e.target.classList.remove('open');
            });
        </script>
    `;

    return pageLayout({
        title: 'Inventario — Admin SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'inventario',
    }, body);
}

function getAdminInventarioHistorialHTML(user, prod, movimientos) {
    const rows = movimientos.length ? movimientos.map(m => {
        const fecha = new Date(m.creado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
        const deltaColor = m.delta > 0 ? 'var(--accent-green)' : 'var(--primary-red)';
        return `
        <tr>
            <td class="text-soft" style="font-size:12px">${escape(fecha)}</td>
            <td>${escape(m.almacen_nombre || '')}</td>
            <td><span class="badge badge-quote">${escape(motivoLabel(m.motivo))}</span></td>
            <td style="color:${deltaColor};font-weight:800">${m.delta > 0 ? '+' : ''}${m.delta}</td>
            <td>${escape(m.referencia || '')}</td>
            <td class="text-soft" style="font-size:12px">${escape(m.notas || '')}</td>
            <td class="text-soft" style="font-size:11px">${escape(m.usuario_email || '')}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty-state"><p>Sin movimientos registrados.</p></div></td></tr>`;

    const body = `
        <div class="toolbar">
            <h1 style="margin:0">Historial de inventario</h1>
            <a href="${STORE_MOUNT}/admin/inventario" class="btn btn-outline">← Inventario</a>
        </div>

        <div class="panel">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
                <div>
                    <div class="panel-title" style="margin:0">Producto</div>
                    <h3 style="margin:6px 0 0">${escape(prod.nombre)}</h3>
                    <div class="text-soft" style="font-family:monospace">${escape(prod.sku)}</div>
                </div>
                <a href="${STORE_MOUNT}/admin/productos/${prod.id}/editar" class="btn btn-outline btn-sm">Editar producto</a>
            </div>
        </div>

        <div class="panel mt-4" style="padding:0;overflow:hidden">
            <table class="table" style="border:none">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Almacén</th>
                        <th>Motivo</th>
                        <th>Δ</th>
                        <th>Referencia</th>
                        <th>Notas</th>
                        <th>Usuario</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    return pageLayout({
        title: `Historial ${prod.sku} — Admin`,
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'inventario',
    }, body);
}

module.exports = { getAdminInventarioHTML, getAdminInventarioHistorialHTML };
