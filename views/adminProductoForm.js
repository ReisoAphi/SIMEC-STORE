// views/adminProductoForm.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function getAdminProductoFormHTML(user, prod, categorias, almacenes, imagenes) {
    const isEdit = !!prod;
    const p = prod || {};
    const especs = p.especificaciones || {};
    const oem = Array.isArray(p.oem_compatibles) ? p.oem_compatibles.join('\n') : '';

    const catOpts = categorias.map(c =>
        `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${escape(c.nombre)}</option>`
    ).join('');

    const especRows = Object.keys(especs).length
        ? Object.entries(especs).map(([k, v]) => rowEspec(k, v)).join('')
        : rowEspec('', '');

    function rowEspec(k, v) {
        return `
        <div class="espec-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px">
            <input type="text" class="input" placeholder="Característica (ej: Diámetro interior)" value="${escape(k)}">
            <input type="text" class="input" placeholder="Valor (ej: 17 mm)" value="${escape(v)}">
            <button type="button" class="btn btn-outline btn-sm" onclick="this.parentElement.remove()">✕</button>
        </div>`;
    }

    const imagesSection = isEdit ? `
        <div class="panel mt-6">
            <div class="panel-title">Imágenes (${imagenes.length})</div>
            <div id="imgGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px">
                ${imagenes.map(img => imgCard(img)).join('') || '<p class="text-soft" style="grid-column:1/-1">Sin imágenes todavía.</p>'}
            </div>
            <div>
                <input type="file" id="filesInput" accept="image/jpeg,image/png,image/webp" multiple style="display:none">
                <button type="button" class="btn btn-outline" onclick="document.getElementById('filesInput').click()">+ Subir imágenes</button>
                <span class="text-soft" style="font-size:11px;margin-left:8px">JPG, PNG o WEBP · máx 15MB c/u · se convierten automáticamente a WebP 1600px</span>
            </div>
        </div>
    ` : `
        <div class="panel mt-6" style="text-align:center;color:var(--text-soft)">
            Guarda el producto primero para poder subir imágenes.
        </div>
    `;

    function imgCard(img) {
        return `
        <div class="img-card" data-id="${img.id}" style="position:relative;background:#0d0d0d;border:1px solid ${img.es_principal ? 'var(--primary-red)' : 'var(--border)'}">
            <div style="aspect-ratio:1/1;overflow:hidden">
                <img src="${STORE_MOUNT}${escape(img.url)}" style="width:100%;height:100%;object-fit:cover" alt="">
            </div>
            <div style="position:absolute;top:6px;left:6px;display:flex;gap:4px">
                ${img.es_principal ? '<span class="badge badge-in-stock" style="background:var(--primary-red);color:#fff;border:none">Principal</span>' : ''}
            </div>
            <div style="position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:4px">
                ${!img.es_principal ? `<button type="button" class="btn btn-outline btn-sm" style="padding:3px 6px;font-size:9px" onclick="setPrincipal(${img.id})" title="Marcar como principal">★</button>` : ''}
                <button type="button" class="btn btn-outline btn-sm" style="padding:3px 6px;font-size:9px" onclick="delImg(${img.id})" title="Eliminar">✕</button>
            </div>
        </div>`;
    }

    const inventarioSection = isEdit ? `
        <div class="panel mt-6">
            <div class="panel-title">Inventario</div>
            ${almacenes.map(a => {
                const inv = p.inventarioMap?.[a.id] || { stock_disponible: 0, stock_reservado: 0 };
                return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <div><strong>${escape(a.nombre)}</strong></div>
                    <div>Disponible: <strong>${inv.stock_disponible}</strong> · Reservado: <span class="text-soft">${inv.stock_reservado}</span></div>
                </div>`;
            }).join('')}
            <a href="${STORE_MOUNT}/admin/inventario?q=${encodeURIComponent(p.sku || '')}" class="btn btn-outline mt-4">Ajustar inventario →</a>
        </div>
    ` : '';

    const body = `
        <div class="toolbar">
            <h1 style="margin:0">${isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
            <a href="${STORE_MOUNT}/admin/productos" class="btn btn-outline">← Volver</a>
        </div>

        <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start">
            <div>
                <form id="prodForm" class="panel">
                    <div class="field-row">
                        <div class="field">
                            <label>SKU / Número de parte *</label>
                            <input type="text" name="sku" class="input" required maxlength="80" value="${escape(p.sku || '')}" placeholder="Ej: 6203-2RS-SKF">
                        </div>
                        <div class="field">
                            <label>Marca</label>
                            <input type="text" name="marca" class="input" maxlength="120" value="${escape(p.marca || '')}" placeholder="SKF, NSK, Siemens...">
                        </div>
                    </div>

                    <div class="field">
                        <label>Nombre *</label>
                        <input type="text" name="nombre" class="input" required maxlength="200" value="${escape(p.nombre || '')}" placeholder="Balero rígido de bolas 6203-2RS">
                    </div>

                    <div class="field-row">
                        <div class="field">
                            <label>Categoría</label>
                            <select name="categoria_id" class="select">
                                <option value="">— Sin categoría —</option>
                                ${catOpts}
                            </select>
                        </div>
                        <div class="field">
                            <label>Precio (${(p.moneda || 'MXN')}) *</label>
                            <input type="number" name="precio_lista" class="input" step="0.01" min="0" required value="${p.precio_lista || 0}">
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field">
                            <label>Moneda</label>
                            <select name="moneda" class="select">
                                <option value="MXN" ${(p.moneda || 'MXN') === 'MXN' ? 'selected' : ''}>MXN</option>
                                <option value="USD" ${p.moneda === 'USD' ? 'selected' : ''}>USD</option>
                            </select>
                        </div>
                        <div class="field">
                            <label>&nbsp;</label>
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding-top:8px">
                                <input type="checkbox" name="iva_incluido" ${p.iva_incluido ? 'checked' : ''}> El precio incluye IVA
                            </label>
                        </div>
                    </div>

                    <div class="field">
                        <label>Descripción corta</label>
                        <textarea name="descripcion_corta" class="textarea" rows="2" maxlength="500" placeholder="Resumen de 1-2 líneas que aparece en resultados de búsqueda.">${escape(p.descripcion_corta || '')}</textarea>
                    </div>

                    <div class="field">
                        <label>Descripción larga (rica en palabras clave)</label>
                        <textarea name="descripcion_larga" class="textarea" rows="8" placeholder="Descripción completa: aplicación, ventajas, materiales, tolerancias, referencias equivalentes...">${escape(p.descripcion_larga || '')}</textarea>
                        <div class="help">Escribe contenido único (no copies del proveedor). Menciona el número de parte y sus equivalencias — mejora el SEO por búsquedas específicas.</div>
                    </div>

                    <div class="field">
                        <label>Especificaciones técnicas</label>
                        <div id="especList">${especRows}</div>
                        <button type="button" class="btn btn-outline btn-sm" onclick="addEspec()">+ Agregar característica</button>
                    </div>

                    <div class="field">
                        <label>Números de parte equivalentes / OEM (uno por línea)</label>
                        <textarea name="oem_compatibles" class="textarea" rows="3" placeholder="6203-2RS/C3\nSKF 6203-2RS1\nNSK 6203DDU">${escape(oem)}</textarea>
                        <div class="help">Muy útil para SEO: los clientes buscan por muchas nomenclaturas distintas.</div>
                    </div>

                    <div class="field-row">
                        <div class="field">
                            <label>Peso (kg) *</label>
                            <input type="number" name="peso_kg" class="input" step="0.001" min="0" value="${p.peso_kg || 0}">
                        </div>
                        <div class="field">
                            <label>Largo (cm)</label>
                            <input type="number" name="largo_cm" class="input" step="0.1" min="0" value="${p.largo_cm || 0}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label>Ancho (cm)</label>
                            <input type="number" name="ancho_cm" class="input" step="0.1" min="0" value="${p.ancho_cm || 0}">
                        </div>
                        <div class="field">
                            <label>Alto (cm)</label>
                            <input type="number" name="alto_cm" class="input" step="0.1" min="0" value="${p.alto_cm || 0}">
                        </div>
                    </div>
                    <div class="help" style="margin-top:-8px;margin-bottom:16px">Peso y dimensiones son obligatorios para calcular el envío con Skydropx.</div>

                    <div class="field">
                        <label>Meta title (SEO — 60 caracteres ideal)</label>
                        <input type="text" name="meta_title" class="input" maxlength="200" value="${escape(p.meta_title || '')}" placeholder="Ej: Balero 6203-2RS SKF | SIMEC Store México">
                    </div>
                    <div class="field">
                        <label>Meta description (SEO — 155 caracteres ideal)</label>
                        <textarea name="meta_description" class="textarea" rows="2" maxlength="320" placeholder="Descripción que aparece en Google.">${escape(p.meta_description || '')}</textarea>
                    </div>

                    <div class="field-row">
                        <div class="field">
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding-top:8px">
                                <input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Publicado en la tienda
                            </label>
                        </div>
                        <div class="field">
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding-top:8px">
                                <input type="checkbox" name="permite_cotizacion" ${p.permite_cotizacion !== false ? 'checked' : ''}> Permitir cotización cuando no haya stock
                            </label>
                        </div>
                    </div>

                    ${isEdit ? `
                    <div class="field">
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                            <input type="checkbox" name="regenerar_slug"> Regenerar URL desde el nombre + SKU
                        </label>
                        <div class="help text-red">Cambia la URL pública del producto. Rompe enlaces existentes.</div>
                    </div>` : ''}

                    <div class="flex gap-3 mt-4">
                        <button type="submit" class="btn btn-red">${isEdit ? 'Guardar cambios' : 'Crear producto'}</button>
                        <a href="${STORE_MOUNT}/admin/productos" class="btn btn-outline">Cancelar</a>
                    </div>
                </form>
            </div>

            <div>
                ${imagesSection}
                ${inventarioSection}
                ${isEdit ? `
                <div class="panel mt-6">
                    <div class="panel-title">URL pública</div>
                    <a href="${STORE_MOUNT}/producto/${escape(p.slug || '')}" target="_blank" style="color:var(--primary-red);word-break:break-all">${STORE_MOUNT}/producto/${escape(p.slug || '')}</a>
                    <div class="text-soft mt-2" style="font-size:11px">Se genera automáticamente cuando publiques.</div>
                </div>` : ''}
            </div>
        </div>

        <script>
            function addEspec() {
                const list = document.getElementById('especList');
                const div = document.createElement('div');
                div.innerHTML = ${JSON.stringify(rowEspec('', ''))};
                list.appendChild(div.firstElementChild);
            }

            function recolectarEspecs() {
                const out = [];
                document.querySelectorAll('.espec-row').forEach(row => {
                    const inputs = row.querySelectorAll('input');
                    out.push({ clave: inputs[0].value.trim(), valor: inputs[1].value.trim() });
                });
                return out.filter(r => r.clave);
            }

            document.getElementById('prodForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const f = e.target;
                const btn = f.querySelector('button[type=submit]');
                btn.classList.add('loading'); btn.textContent = 'Guardando...';
                const payload = {
                    sku: f.sku.value, nombre: f.nombre.value, marca: f.marca.value,
                    categoria_id: f.categoria_id.value || null,
                    descripcion_corta: f.descripcion_corta.value,
                    descripcion_larga: f.descripcion_larga.value,
                    especificaciones: recolectarEspecs(),
                    oem_compatibles: f.oem_compatibles.value,
                    precio_lista: f.precio_lista.value,
                    moneda: f.moneda.value,
                    iva_incluido: f.iva_incluido.checked,
                    peso_kg: f.peso_kg.value,
                    largo_cm: f.largo_cm.value, ancho_cm: f.ancho_cm.value, alto_cm: f.alto_cm.value,
                    meta_title: f.meta_title.value,
                    meta_description: f.meta_description.value,
                    permite_cotizacion: f.permite_cotizacion.checked,
                    activo: f.activo.checked,
                    regenerar_slug: f.regenerar_slug ? f.regenerar_slug.checked : false,
                };
                const url = ${isEdit ? `'${STORE_MOUNT}/api/admin/productos/${p.id}'` : `'${STORE_MOUNT}/api/admin/productos'`};
                const method = ${isEdit ? "'PUT'" : "'POST'"};
                try {
                    const r = await fetch(url, {
                        method, headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('${isEdit ? 'Guardado' : 'Producto creado'}');
                        setTimeout(() => window.location.href = ${isEdit ? `'${STORE_MOUNT}/admin/productos'` : `'${STORE_MOUNT}/admin/productos/' + data.id + '/editar'`}, 500);
                    } else window.showToast(data.error || 'Error');
                } catch (err) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = '${isEdit ? 'Guardar cambios' : 'Crear producto'}'; }
            });

            ${isEdit ? `
            // ------------- Imágenes -------------
            const filesInput = document.getElementById('filesInput');
            filesInput.addEventListener('change', async (e) => {
                if (!e.target.files.length) return;
                const fd = new FormData();
                for (const f of e.target.files) fd.append('imagenes', f);
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/productos/${p.id}/imagenes', {
                        method: 'POST', body: fd
                    });
                    const data = await r.json();
                    if (r.ok) { window.showSuccess('Imágenes subidas'); setTimeout(() => location.reload(), 500); }
                    else window.showToast(data.error || 'Error');
                } catch (err) { window.showToast('Error subiendo'); }
            });

            async function setPrincipal(imgId) {
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/productos/${p.id}/imagenes/' + imgId + '/principal', { method: 'POST' });
                    if (r.ok) { window.showSuccess('Imagen principal actualizada'); setTimeout(()=>location.reload(),400); }
                    else window.showToast('Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }

            async function delImg(imgId) {
                if (!confirm('¿Eliminar esta imagen?')) return;
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/productos/${p.id}/imagenes/' + imgId, { method: 'DELETE' });
                    if (r.ok) { window.showSuccess('Eliminada'); setTimeout(()=>location.reload(),400); }
                    else window.showToast('Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }
            ` : ''}
        </script>
    `;

    return pageLayout({
        title: isEdit ? `Editar ${p.nombre} — Admin` : 'Nuevo producto — Admin',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'productos',
    }, body);
}

module.exports = { getAdminProductoFormHTML };
