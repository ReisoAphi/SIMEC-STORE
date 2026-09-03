// views/adminCategorias.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function renderTree(cats) {
    // Organiza jerárquicamente por padre_id
    const byParent = new Map();
    cats.forEach(c => {
        const k = c.padre_id || 0;
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(c);
    });

    const rowsHtml = [];
    const walk = (parentId, depth) => {
        const list = byParent.get(parentId || 0) || [];
        list.forEach(c => {
            const indent = '&nbsp;'.repeat(depth * 4);
            const prefix = depth > 0 ? '↳ ' : '';
            rowsHtml.push(`
                <tr>
                    <td>${indent}${prefix}<strong>${escape(c.nombre)}</strong>
                        ${!c.activo ? '<span class="badge badge-out" style="margin-left:8px">Inactiva</span>' : ''}
                    </td>
                    <td class="text-soft" style="font-family:monospace;font-size:12px">${escape(c.slug)}</td>
                    <td>${c.n_productos}</td>
                    <td class="text-right">
                        <div class="row-actions" style="justify-content:flex-end">
                            <a href="${STORE_MOUNT}/admin/categorias/${c.id}/editar" class="btn btn-outline btn-sm">Editar</a>
                            <button class="btn btn-outline btn-sm" onclick="borrar(${c.id}, '${escape(c.nombre).replace(/'/g,"\\'")}')">Borrar</button>
                        </div>
                    </td>
                </tr>
            `);
            walk(c.id, depth + 1);
        });
    };
    walk(0, 0);

    return rowsHtml.join('');
}

function getAdminCategoriasHTML(user, cats) {
    const rows = cats.length
        ? renderTree(cats)
        : `<tr><td colspan="4"><div class="empty-state"><h3>Aún no hay categorías</h3><p>Crea tu primera categoría para organizar el catálogo.</p></div></td></tr>`;

    const body = `
        <div class="toolbar">
            <h1 style="margin:0">Categorías</h1>
            <div><a href="${STORE_MOUNT}/admin/categorias/nueva" class="btn btn-red">+ Nueva categoría</a></div>
        </div>

        <div style="overflow-x:auto">
            <table class="table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Slug</th>
                        <th>Productos</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <script>
            async function borrar(id, nombre) {
                if (!confirm('¿Eliminar la categoría "' + nombre + '"? Esta acción no se puede deshacer.')) return;
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/categorias/' + id, { method: 'DELETE' });
                    const data = await r.json();
                    if (r.ok) { window.showSuccess('Eliminada'); setTimeout(()=>location.reload(),400); }
                    else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }
        </script>
    `;

    return pageLayout({
        title: 'Categorías — Admin SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'categorias',
    }, body);
}

function getAdminCategoriaFormHTML(user, cat, padres) {
    const isEdit = !!cat;
    const c = cat || {};

    const padresOpts = padres.map(p =>
        `<option value="${p.id}" ${c.padre_id === p.id ? 'selected' : ''}>${escape(p.nombre)}</option>`
    ).join('');

    const body = `
        <div class="toolbar">
            <h1 style="margin:0">${isEdit ? 'Editar categoría' : 'Nueva categoría'}</h1>
            <a href="${STORE_MOUNT}/admin/categorias" class="btn btn-outline">← Volver</a>
        </div>

        <form id="catForm" class="panel" style="max-width:720px">
            <div class="field">
                <label>Nombre *</label>
                <input type="text" name="nombre" class="input" required maxlength="140" value="${escape(c.nombre || '')}">
                ${isEdit ? `<div class="help">Slug actual: <code>${escape(c.slug)}</code> — marca abajo para regenerar.</div>` : ''}
            </div>

            <div class="field-row">
                <div class="field">
                    <label>Categoría padre (opcional)</label>
                    <select name="padre_id" class="select">
                        <option value="">— Ninguna (categoría raíz) —</option>
                        ${padresOpts}
                    </select>
                </div>
                <div class="field">
                    <label>Orden</label>
                    <input type="number" name="orden" class="input" value="${c.orden || 0}">
                </div>
            </div>

            <div class="field">
                <label>Descripción</label>
                <textarea name="descripcion" class="textarea" rows="3" maxlength="1000">${escape(c.descripcion || '')}</textarea>
            </div>

            <div class="field">
                <label>Meta title (SEO)</label>
                <input type="text" name="meta_title" class="input" maxlength="200" value="${escape(c.meta_title || '')}" placeholder="Ej: Baleros industriales SKF y NSK en México">
            </div>

            <div class="field">
                <label>Meta description (SEO)</label>
                <textarea name="meta_description" class="textarea" rows="2" maxlength="320" placeholder="Descripción corta que aparece en Google (150-160 caracteres).">${escape(c.meta_description || '')}</textarea>
            </div>

            <div class="field">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                    <input type="checkbox" name="activo" ${c.activo !== false ? 'checked' : ''}> Activa (visible en la tienda)
                </label>
            </div>

            ${isEdit ? `
            <div class="field">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                    <input type="checkbox" name="regenerar_slug"> Regenerar slug desde el nombre
                </label>
                <div class="help text-red">Cambiar el slug rompe enlaces existentes. Solo si es necesario.</div>
            </div>` : ''}

            <div class="flex gap-3 mt-4">
                <button type="submit" class="btn btn-red">${isEdit ? 'Guardar cambios' : 'Crear categoría'}</button>
                <a href="${STORE_MOUNT}/admin/categorias" class="btn btn-outline">Cancelar</a>
            </div>
        </form>

        <script>
            document.getElementById('catForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const f = e.target;
                const btn = f.querySelector('button[type=submit]');
                btn.classList.add('loading'); btn.textContent = 'Guardando...';

                const payload = {
                    nombre: f.nombre.value.trim(),
                    padre_id: f.padre_id.value || null,
                    descripcion: f.descripcion.value,
                    meta_title: f.meta_title.value,
                    meta_description: f.meta_description.value,
                    orden: parseInt(f.orden.value, 10) || 0,
                    activo: f.activo.checked,
                    regenerar_slug: f.regenerar_slug ? f.regenerar_slug.checked : false,
                };
                const url = ${isEdit ? `'${STORE_MOUNT}/api/admin/categorias/${c.id}'` : `'${STORE_MOUNT}/api/admin/categorias'`};
                const method = ${isEdit ? "'PUT'" : "'POST'"};
                try {
                    const r = await fetch(url, {
                        method, headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('${isEdit ? 'Guardada' : 'Creada'}');
                        setTimeout(() => window.location.href = '${STORE_MOUNT}/admin/categorias', 500);
                    } else {
                        window.showToast(data.error || 'Error');
                    }
                } catch (err) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = '${isEdit ? 'Guardar cambios' : 'Crear categoría'}'; }
            });
        </script>
    `;

    return pageLayout({
        title: isEdit ? `Editar ${cat.nombre} — Admin` : 'Nueva categoría — Admin',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'categorias',
    }, body);
}

module.exports = { getAdminCategoriasHTML, getAdminCategoriaFormHTML };
