// views/adminUsuarios.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function formatFecha(d) {
    if (!d) return '';
    const x = new Date(d);
    return x.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function rolBadge(rol) {
    const colors = {
        admin: 'background:rgba(217,0,0,.15);color:var(--primary-red);border:1px solid rgba(217,0,0,.4)',
        almacenista: 'background:rgba(23,162,184,.15);color:var(--accent-blue);border:1px solid rgba(23,162,184,.4)',
        ventas: 'background:rgba(40,167,69,.15);color:var(--accent-green);border:1px solid rgba(40,167,69,.4)',
    };
    return `<span class="badge" style="${colors[rol] || colors.admin}">${escape(rol)}</span>`;
}

function getAdminUsuariosHTML(user, usuarios) {
    const rows = usuarios.length ? usuarios.map(u => `
        <tr data-id="${u.id}">
            <td><strong>${escape(u.email)}</strong>${u.id === user.id ? '<span class="badge badge-quote" style="margin-left:8px">Tú</span>' : ''}</td>
            <td>${escape(u.nombre || '—')}</td>
            <td>${rolBadge(u.rol)}</td>
            <td>${u.activo
                ? '<span class="badge badge-in-stock">Activo</span>'
                : '<span class="badge badge-out">Inactivo</span>'}</td>
            <td class="text-soft" style="font-size:12px">${formatFecha(u.creado_en)}</td>
            <td class="text-right">
                <div class="row-actions" style="justify-content:flex-end">
                    <button class="btn btn-outline btn-sm" onclick='editar(${JSON.stringify(u).replace(/'/g, "&#39;")})'>Editar</button>
                    ${u.id !== user.id ? `<button class="btn btn-outline btn-sm" onclick="borrar(${u.id}, '${escape(u.email).replace(/'/g,"\\'")}')">Borrar</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="6"><div class="empty-state"><h3>Aún no hay usuarios adicionales</h3><p>Agrega otros admins para que puedan cargar productos, ver pedidos y responder cotizaciones.</p></div></td></tr>`;

    const body = `
        <div class="toolbar">
            <h1 style="margin:0">Usuarios</h1>
            <button class="btn btn-red" onclick="abrirModal()">+ Nuevo usuario</button>
        </div>

        <div class="panel" style="padding:0;overflow:hidden">
            <table class="table" style="border:none">
                <thead>
                    <tr>
                        <th>Correo</th>
                        <th>Nombre</th>
                        <th>Rol</th>
                        <th>Estatus</th>
                        <th>Alta</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <p class="text-soft mt-4" style="font-size:12px">
            Los usuarios acceden con su correo desde <code>${STORE_MOUNT}/admin/login</code> — el sistema les envía un código de 6 dígitos.
            Roles: <strong>admin</strong> (acceso total), <strong>almacenista</strong> (solo inventario), <strong>ventas</strong> (solo pedidos y cotizaciones).
        </p>

        <!-- Modal -->
        <div class="modal-overlay" id="modal">
            <div class="modal-box">
                <h3 id="modalTitle">Nuevo usuario</h3>
                <form id="userForm">
                    <input type="hidden" id="userId" value="">
                    <div class="field">
                        <label>Correo *</label>
                        <input type="email" id="email" class="input" required autocomplete="off">
                    </div>
                    <div class="field">
                        <label>Nombre (opcional)</label>
                        <input type="text" id="nombre" class="input" maxlength="120">
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label>Rol</label>
                            <select id="rol" class="select">
                                <option value="admin">Admin</option>
                                <option value="almacenista">Almacenista</option>
                                <option value="ventas">Ventas</option>
                            </select>
                        </div>
                        <div class="field">
                            <label>&nbsp;</label>
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding-top:8px">
                                <input type="checkbox" id="activo" checked> Activo
                            </label>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="cerrarModal()">Cancelar</button>
                        <button type="submit" class="btn btn-red" id="btnGuardar">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            const modal = document.getElementById('modal');
            const form = document.getElementById('userForm');

            function abrirModal(u) {
                document.getElementById('userId').value = u?.id || '';
                document.getElementById('email').value = u?.email || '';
                document.getElementById('email').disabled = !!u;  // no editar email
                document.getElementById('nombre').value = u?.nombre || '';
                document.getElementById('rol').value = u?.rol || 'admin';
                document.getElementById('activo').checked = u ? !!u.activo : true;
                document.getElementById('modalTitle').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
                modal.classList.add('open');
            }
            function cerrarModal() { modal.classList.remove('open'); }
            function editar(u) { abrirModal(u); }

            async function borrar(id, email) {
                if (!confirm('¿Eliminar al usuario "' + email + '"?')) return;
                try {
                    const r = await fetch('${STORE_MOUNT}/api/admin/usuarios/' + id, { method: 'DELETE' });
                    const data = await r.json();
                    if (r.ok) { window.showSuccess('Eliminado'); setTimeout(() => location.reload(), 400); }
                    else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('userId').value;
                const payload = {
                    email: document.getElementById('email').value.trim().toLowerCase(),
                    nombre: document.getElementById('nombre').value.trim(),
                    rol: document.getElementById('rol').value,
                    activo: document.getElementById('activo').checked,
                };
                const btn = document.getElementById('btnGuardar');
                btn.classList.add('loading'); btn.textContent = 'Guardando...';
                try {
                    const url = id ? '${STORE_MOUNT}/api/admin/usuarios/' + id : '${STORE_MOUNT}/api/admin/usuarios';
                    const method = id ? 'PUT' : 'POST';
                    const r = await fetch(url, {
                        method, headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess(id ? 'Guardado' : 'Usuario creado');
                        setTimeout(() => location.reload(), 400);
                    } else window.showToast(data.error || 'Error');
                } catch (e) { window.showToast('Error de conexión'); }
                finally { btn.classList.remove('loading'); btn.textContent = 'Guardar'; }
            });

            modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
        </script>
    `;

    return pageLayout({
        title: 'Usuarios — Admin SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
        admin: true, user, sidebarActive: 'usuarios',
    }, body);
}

module.exports = { getAdminUsuariosHTML };
