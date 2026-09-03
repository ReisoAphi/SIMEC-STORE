// views/publicCheckout.js
const { pageLayout, escape } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { fmtMoneda, breadcrumbsHTML, cartCounterScript } = require('./publicComponents');

const ESTADOS_MX = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
    'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
    'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas',
    'Tlaxcala','Veracruz','Yucatán','Zacatecas',
];

const USOS_CFDI = [
    ['G01', 'G01 · Adquisición de mercancías'],
    ['G02', 'G02 · Devoluciones, descuentos o bonificaciones'],
    ['G03', 'G03 · Gastos en general'],
    ['I04', 'I04 · Equipo de cómputo y accesorios'],
    ['I08', 'I08 · Otra maquinaria y equipo'],
    ['P01', 'P01 · Por definir'],
    ['S01', 'S01 · Sin efectos fiscales'],
];

const REGIMENES = [
    ['601', '601 · General de Ley Personas Morales'],
    ['603', '603 · Personas Morales con Fines no Lucrativos'],
    ['612', '612 · Personas Físicas con Actividades Empresariales'],
    ['621', '621 · Incorporación Fiscal'],
    ['626', '626 · Régimen Simplificado de Confianza'],
    ['605', '605 · Sueldos y Salarios'],
    ['616', '616 · Sin obligaciones fiscales'],
];

function getPublicCheckoutHTML({ cart, mpConfigurado, cliente, ultimaDireccion }) {
    const itemsHtml = cart.items.map(it => `
        <tr>
            <td>
                <div style="font-size:12px">${escape(it.prod.nombre)}</div>
                <div class="text-soft" style="font-family:monospace;font-size:10px">${escape(it.prod.sku)} × ${it.cantidad}</div>
            </td>
            <td class="text-right" style="font-size:12px">${fmtMoneda(Number(it.prod.precio_lista) * it.cantidad, cart.moneda)}</td>
        </tr>
    `).join('');

    const alertMP = !mpConfigurado ? `
        <div style="background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.4);color:#FFC107;padding:12px 16px;margin-bottom:16px;font-size:12px">
            <strong>⚠ Modo demostración</strong> — Mercado Pago no está configurado en <code>.env</code>. Puedes probar el flujo pero al final se te indicará que faltan credenciales.
        </div>` : '';

    // Banner de sesión: si hay cliente, saludo + cerrar sesión; si no, opción de entrar
    const sessionBanner = cliente ? `
        <div style="background:rgba(40,167,69,.1);border:1px solid rgba(40,167,69,.4);color:var(--accent-green);padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
                <strong>✓ Sesión iniciada como ${escape(cliente.nombre || cliente.email)}</strong>
                <div style="color:var(--text-mid);font-size:12px;margin-top:4px">Tus datos y dirección están precargados${ultimaDireccion ? '' : ' (aún no tienes dirección guardada)'}.</div>
            </div>
            <button type="button" class="btn btn-outline btn-sm" onclick="cerrarSesionCliente()">Cerrar sesión</button>
        </div>
    ` : `
        <div style="background:rgba(23,162,184,.1);border:1px solid rgba(23,162,184,.4);color:var(--accent-blue);padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="font-size:13px">¿Ya tienes cuenta con nosotros? Iniciar sesión precarga tu dirección y datos fiscales.</div>
            <button type="button" class="btn btn-outline btn-sm" onclick="abrirLogin()">Iniciar sesión</button>
        </div>
    `;

    // Prefill server-side de contacto y dirección si hay cliente
    const preContact = {
        email: cliente?.email || '',
        nombre: cliente?.nombre || '',
        telefono: cliente?.telefono || '',
        empresa: cliente?.razon_social || '',
    };
    const preDir = ultimaDireccion || {};

    const body = `
        <div class="container">
            ${breadcrumbsHTML([
                { href: STORE_MOUNT, label: 'Inicio' },
                { href: `${STORE_MOUNT}/carrito`, label: 'Carrito' },
                { label: 'Checkout' },
            ])}
            <h1 style="text-transform:uppercase;letter-spacing:1px;font-size:22px;margin:12px 0 20px">Finalizar compra</h1>
            ${alertMP}
            ${sessionBanner}

            <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start">
                <form id="checkoutForm" class="stack">
                    <!-- ========= 1. Contacto ========= -->
                    <div class="panel">
                        <div class="panel-title">1 · Contacto</div>
                        <div class="field-row">
                            <div class="field">
                                <label>Correo *</label>
                                <input type="email" name="contact_email" class="input" required value="${escape(preContact.email)}" ${cliente ? 'readonly title="Correo de tu cuenta"' : ''}>
                                <div id="emailHint" class="help hidden" style="color:var(--accent-blue)"></div>
                            </div>
                            <div class="field">
                                <label>Teléfono</label>
                                <input type="tel" name="contact_tel" class="input" value="${escape(preContact.telefono)}">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field">
                                <label>Nombre *</label>
                                <input type="text" name="contact_nombre" class="input" required value="${escape(preContact.nombre)}">
                            </div>
                            <div class="field">
                                <label>Empresa (opcional)</label>
                                <input type="text" name="contact_empresa" class="input" value="${escape(preContact.empresa)}">
                            </div>
                        </div>
                    </div>

                    <!-- ========= 2. Dirección ========= -->
                    <div class="panel">
                        <div class="panel-title">2 · Dirección de envío</div>
                        <div class="field-row">
                            <div class="field">
                                <label>Código postal *</label>
                                <input type="text" name="dir_cp" id="dir_cp" class="input" pattern="\\d{5}" maxlength="5" required value="${escape(preDir.cp || '')}">
                                <div class="help">Al ingresarlo cotizamos el envío automáticamente.</div>
                            </div>
                            <div class="field">
                                <label>Estado *</label>
                                <select name="dir_estado" class="select" required>
                                    <option value="">— Seleccionar —</option>
                                    ${ESTADOS_MX.map(e => `<option value="${escape(e)}" ${preDir.estado === e ? 'selected' : ''}>${escape(e)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field">
                                <label>Municipio / Ciudad *</label>
                                <input type="text" name="dir_municipio" class="input" required value="${escape(preDir.municipio || '')}">
                            </div>
                            <div class="field">
                                <label>Colonia</label>
                                <input type="text" name="dir_colonia" class="input" value="${escape(preDir.colonia || '')}">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field">
                                <label>Calle *</label>
                                <input type="text" name="dir_calle" class="input" required value="${escape(preDir.calle || '')}">
                            </div>
                            <div class="field-row" style="grid-template-columns:1fr 1fr;margin:0">
                                <div class="field">
                                    <label>No. exterior</label>
                                    <input type="text" name="dir_ext" class="input" value="${escape(preDir.numero_ext || '')}">
                                </div>
                                <div class="field">
                                    <label>No. interior</label>
                                    <input type="text" name="dir_int" class="input" value="${escape(preDir.numero_int || '')}">
                                </div>
                            </div>
                        </div>
                        <div class="field">
                            <label>Referencias (opcional)</label>
                            <input type="text" name="dir_refs" class="input" maxlength="200" value="${escape(preDir.referencias || '')}">
                        </div>
                    </div>

                    <!-- ========= 3. Envío ========= -->
                    <div class="panel">
                        <div class="panel-title">3 · Método de envío</div>
                        <div id="ratesContainer" class="text-soft" style="text-align:center;padding:20px">
                            ${preDir.cp ? 'Cotizando envío...' : 'Ingresa el código postal para cotizar el envío.'}
                        </div>
                    </div>

                    <!-- ========= 4. Factura (opcional) ========= -->
                    <div class="panel">
                        <div class="panel-title">4 · Facturación (opcional)</div>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                            <input type="checkbox" id="chkFactura" name="requiere_factura"> Necesito factura CFDI 4.0
                        </label>
                        <div id="facturaFields" class="hidden mt-4">
                            <div class="field-row">
                                <div class="field">
                                    <label>Razón social *</label>
                                    <input type="text" name="factura_razon" class="input">
                                </div>
                                <div class="field">
                                    <label>RFC *</label>
                                    <input type="text" name="factura_rfc" class="input" style="text-transform:uppercase">
                                </div>
                            </div>
                            <div class="field-row">
                                <div class="field">
                                    <label>Régimen fiscal *</label>
                                    <select name="factura_regimen" class="select">
                                        ${REGIMENES.map(([k, v]) => `<option value="${k}">${escape(v)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="field">
                                    <label>Uso CFDI *</label>
                                    <select name="factura_uso" class="select">
                                        ${USOS_CFDI.map(([k, v]) => `<option value="${k}" ${k === 'G03' ? 'selected' : ''}>${escape(v)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="field">
                                <label>CP fiscal (donde estás registrado en el SAT) *</label>
                                <input type="text" name="factura_cp" class="input" maxlength="5">
                            </div>
                        </div>
                    </div>

                    <!-- ========= 5. Notas ========= -->
                    <div class="panel">
                        <div class="panel-title">Notas adicionales (opcional)</div>
                        <textarea name="notas" class="textarea" rows="2" maxlength="500" placeholder="Instrucciones especiales de entrega..."></textarea>
                    </div>

                    ${!cliente ? `
                    <!-- ========= 6. Crear cuenta ========= -->
                    <div class="panel" style="border-top:3px solid var(--accent-blue)">
                        <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">
                            <input type="checkbox" id="chkCrearCuenta" checked style="margin-top:4px">
                            <span>
                                <strong>Crear cuenta para futuras compras</strong>
                                <div class="text-soft" style="font-size:12px;margin-top:4px">
                                    Con tu correo. La próxima vez te enviamos un código de acceso y precargamos tus datos y dirección — no necesitas contraseña.
                                </div>
                            </span>
                        </label>
                    </div>
                    ` : ''}
                </form>

                <!-- ========= Resumen ========= -->
                <div>
                    <div class="panel">
                        <div class="panel-title">Resumen del pedido</div>
                        <div style="max-height:280px;overflow:auto;margin-bottom:12px">
                            <table style="width:100%;font-size:12px">
                                <tbody>${itemsHtml}</tbody>
                            </table>
                        </div>
                        <div style="border-top:1px solid var(--border);padding-top:12px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Subtotal</span><span id="sumSubtotal">${fmtMoneda(cart.subtotal, cart.moneda)}</span></div>
                            <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--text-soft)"><span>Envío</span><span id="sumEnvio">—</span></div>
                            <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--text-soft)"><span>IVA (16%)</span><span id="sumIva">—</span></div>
                            <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-size:16px">
                                <strong>Total</strong>
                                <strong id="sumTotal" style="color:var(--primary-red)">${fmtMoneda(cart.subtotal * 1.16, cart.moneda)}</strong>
                            </div>
                        </div>
                        <button type="button" class="btn btn-red btn-lg btn-block mt-4" id="btnPagar" disabled>Pagar con Mercado Pago</button>
                        <div class="text-soft mt-2" style="font-size:11px;text-align:center">Tarjeta · SPEI · OXXO · Wallet MP</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal login cliente -->
        <div class="modal-overlay" id="loginModal">
            <div class="modal-box">
                <h3>Entrar a mi cuenta</h3>
                <p class="text-soft" style="font-size:12px;margin:-8px 0 16px">Te enviaremos un código de 6 dígitos a tu correo.</p>
                <form id="loginEmailForm">
                    <div class="field">
                        <label>Correo</label>
                        <input type="email" id="loginEmail" class="input" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('loginModal').classList.remove('open')">Cancelar</button>
                        <button type="submit" class="btn btn-red" id="loginBtn1">Enviar código</button>
                    </div>
                </form>
                <form id="loginCodeForm" class="hidden">
                    <p class="text-soft" style="font-size:12px;margin:0 0 16px">Código enviado a <strong id="loginDisplay" style="color:#fff"></strong></p>
                    <div class="field">
                        <label>Código de 6 dígitos</label>
                        <input type="text" id="loginCode" class="input" inputmode="numeric" maxlength="6" required style="letter-spacing:8px;text-align:center;font-size:18px">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="volverLogin()">Otro correo</button>
                        <button type="submit" class="btn btn-red" id="loginBtn2">Entrar</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            const cartMoneda = ${JSON.stringify(cart.moneda)};
            const cartSubtotal = ${cart.subtotal};
            const clienteLogueado = ${cliente ? 'true' : 'false'};
            let envioSel = null;
            let ratesData = null;

            const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: cartMoneda });

            function recalcTotales() {
                const subtotal = cartSubtotal;
                const envio = envioSel ? Number(envioSel.amount) : 0;
                const iva = (subtotal + envio) * 0.16;
                const total = subtotal + envio + iva;
                document.getElementById('sumSubtotal').textContent = fmt.format(subtotal);
                document.getElementById('sumEnvio').textContent = envio ? fmt.format(envio) : '—';
                document.getElementById('sumIva').textContent = fmt.format(iva);
                document.getElementById('sumTotal').textContent = fmt.format(total);
                document.getElementById('btnPagar').disabled = !envioSel;
            }

            document.getElementById('chkFactura').addEventListener('change', (e) => {
                const fields = document.getElementById('facturaFields');
                fields.classList.toggle('hidden', !e.target.checked);
                fields.querySelectorAll('input,select').forEach(el => el.required = e.target.checked);
            });

            // ---------- Detección de cuenta existente al escribir email ----------
            if (!clienteLogueado) {
                const emailField = document.querySelector('input[name=contact_email]');
                const hint = document.getElementById('emailHint');
                let emailTimer = null;
                emailField.addEventListener('blur', async () => {
                    const email = emailField.value.trim().toLowerCase();
                    if (!email.includes('@')) return;
                    try {
                        const r = await fetch('${STORE_MOUNT}/api/cliente/existe', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });
                        const data = await r.json();
                        if (data.existe) {
                            hint.classList.remove('hidden');
                            hint.innerHTML = '✓ Ya tienes cuenta con este correo. <a href="#" onclick="event.preventDefault();document.getElementById(\\'loginEmail\\').value=\\''+email+'\\';abrirLogin()" style="color:var(--accent-blue);text-decoration:underline">Iniciar sesión</a> para precargar tus datos.';
                        } else {
                            hint.classList.add('hidden');
                        }
                    } catch(e) {}
                });
            }

            // ---------- Cotización de envío al capturar CP ----------
            const cpInput = document.getElementById('dir_cp');
            let cpTimer = null;
            cpInput.addEventListener('input', () => {
                clearTimeout(cpTimer);
                const cp = cpInput.value.trim();
                if (!/^\\d{5}$/.test(cp)) return;
                cpTimer = setTimeout(() => cotizarEnvio(cp), 400);
            });
            if (/^\\d{5}$/.test(cpInput.value.trim())) cotizarEnvio(cpInput.value.trim());

            async function cotizarEnvio(cp) {
                const cont = document.getElementById('ratesContainer');
                cont.innerHTML = '<div class="text-soft" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div><div style="margin-top:8px">Cotizando envío...</div></div>';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/envio/cotizar', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ cp })
                    });
                    const data = await r.json();
                    if (!r.ok) throw new Error(data.error || 'Error');
                    ratesData = data;
                    if (!data.rates || !data.rates.length) {
                        cont.innerHTML = '<div style="color:var(--primary-red)">No hay tarifas disponibles a este CP.</div>';
                        return;
                    }
                    const demoNote = data.demo ? '<div style="color:var(--accent-gold);font-size:11px;margin-bottom:8px">⚠ Tarifas de demostración — configura Skydropx en <code>.env</code> para tarifas reales.</div>' : '';
                    cont.innerHTML = demoNote + data.rates.map((rt, i) => \`
                        <label style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);margin-bottom:8px;cursor:pointer" onclick="selectRate(\${i})">
                            <input type="radio" name="rateOpt" value="\${i}" \${i === 0 ? 'checked' : ''}>
                            <div style="flex:1">
                                <div><strong>\${rt.provider}</strong> — \${rt.service}</div>
                                <div class="text-soft" style="font-size:11px">\${rt.days ? rt.days + ' días hábiles' : ''}</div>
                            </div>
                            <div style="font-weight:800;color:var(--primary-red)">\${fmt.format(rt.amount)}</div>
                        </label>
                    \`).join('');
                    selectRate(0);
                } catch (err) {
                    cont.innerHTML = '<div style="color:var(--primary-red)">' + err.message + '</div>';
                }
            }

            function selectRate(i) {
                if (!ratesData || !ratesData.rates[i]) return;
                envioSel = { ...ratesData.rates[i], quotation_id: ratesData.quotation_id, demo: ratesData.demo };
                document.querySelectorAll('input[name=rateOpt]').forEach((r, idx) => { r.checked = idx === i; });
                recalcTotales();
            }

            // ---------- Modal login ----------
            function abrirLogin() { document.getElementById('loginModal').classList.add('open'); }
            function volverLogin() { document.getElementById('loginCodeForm').classList.add('hidden'); document.getElementById('loginEmailForm').classList.remove('hidden'); }
            document.getElementById('loginModal').addEventListener('click', (e) => { if (e.target.id === 'loginModal') e.target.classList.remove('open'); });

            let loginEmail = '';
            document.getElementById('loginEmailForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                loginEmail = document.getElementById('loginEmail').value.trim().toLowerCase();
                const b = document.getElementById('loginBtn1');
                b.classList.add('loading'); b.textContent = 'Enviando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/cliente/request-code', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: loginEmail })
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('Código enviado');
                        document.getElementById('loginDisplay').textContent = loginEmail;
                        document.getElementById('loginEmailForm').classList.add('hidden');
                        document.getElementById('loginCodeForm').classList.remove('hidden');
                        document.getElementById('loginCode').focus();
                    } else window.showToast(data.error || 'Error');
                } catch(err) { window.showToast('Error de conexión'); }
                finally { b.classList.remove('loading'); b.textContent = 'Enviar código'; }
            });

            document.getElementById('loginCodeForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const b = document.getElementById('loginBtn2');
                b.classList.add('loading'); b.textContent = 'Verificando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/api/cliente/login', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ email: loginEmail, code: document.getElementById('loginCode').value.trim() })
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('¡Bienvenido de nuevo!');
                        setTimeout(() => location.reload(), 400);
                    } else { window.showToast(data.error || 'Error'); b.classList.remove('loading'); b.textContent = 'Entrar'; }
                } catch(err) { window.showToast('Error de conexión'); b.classList.remove('loading'); b.textContent = 'Entrar'; }
            });

            async function cerrarSesionCliente() {
                await fetch('${STORE_MOUNT}/api/cliente/logout', { method: 'POST', credentials: 'same-origin' });
                window.dispatchEvent(new Event('cliente:updated'));
                setTimeout(() => location.reload(), 200);
            }

            // ---------- Enviar checkout ----------
            document.getElementById('btnPagar').addEventListener('click', async () => {
                const f = document.getElementById('checkoutForm');
                if (!f.reportValidity()) return;
                if (!envioSel) { window.showToast('Selecciona un método de envío.'); return; }

                const btn = document.getElementById('btnPagar');
                btn.classList.add('loading'); btn.textContent = 'Preparando pago...';

                const fd = new FormData(f);
                const crearCta = document.getElementById('chkCrearCuenta');
                const payload = {
                    contacto: {
                        email: fd.get('contact_email'),
                        nombre: fd.get('contact_nombre'),
                        telefono: fd.get('contact_tel'),
                        empresa: fd.get('contact_empresa'),
                    },
                    direccion: {
                        cp: fd.get('dir_cp'),
                        estado: fd.get('dir_estado'),
                        municipio: fd.get('dir_municipio'),
                        colonia: fd.get('dir_colonia'),
                        calle: fd.get('dir_calle'),
                        numero_ext: fd.get('dir_ext'),
                        numero_int: fd.get('dir_int'),
                        referencias: fd.get('dir_refs'),
                    },
                    envio: envioSel,
                    factura: fd.get('requiere_factura') ? {
                        requiere: true,
                        razon_social: fd.get('factura_razon'),
                        rfc: fd.get('factura_rfc'),
                        regimen: fd.get('factura_regimen'),
                        uso_cfdi: fd.get('factura_uso'),
                        cp_fiscal: fd.get('factura_cp'),
                    } : { requiere: false },
                    notas: fd.get('notas'),
                    crear_cuenta: crearCta ? crearCta.checked : false,
                };

                try {
                    const r = await fetch('${STORE_MOUNT}/api/checkout/confirmar', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok && data.init_point) {
                        if (data.cuenta_creada) {
                            window.showSuccess('Cuenta creada — usa tu correo la próxima vez');
                        }
                        setTimeout(() => window.location.href = data.init_point, data.cuenta_creada ? 800 : 0);
                    } else if (data.folio) {
                        window.showToast(data.error || 'Configura Mercado Pago');
                        setTimeout(() => window.location.href = '${STORE_MOUNT}/pedido/' + data.folio, 1500);
                    } else {
                        window.showToast(data.error || 'Error');
                        btn.classList.remove('loading'); btn.textContent = 'Pagar con Mercado Pago';
                    }
                } catch (e) {
                    window.showToast('Error de conexión');
                    btn.classList.remove('loading'); btn.textContent = 'Pagar con Mercado Pago';
                }
            });
        </script>
        ${cartCounterScript()}
    `;

    return pageLayout({
        title: 'Checkout — SIMEC Store',
        description: 'Finaliza tu compra en SIMEC Store con envío calculado y factura CFDI 4.0.',
        canonical: `${BASE_URL}${STORE_MOUNT}/checkout`,
        headExtra: '<meta name="robots" content="noindex,nofollow">',
    }, body);
}

module.exports = { getPublicCheckoutHTML };
