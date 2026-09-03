// views/adminLogin.js
const { pageLayout } = require('./layout');
const { STORE_MOUNT } = require('../config/env');

function getAdminLoginHTML() {
    const body = `
        <div class="auth-wrap">
            <div class="auth-card">
                <h1>Panel de administración</h1>
                <div class="subtitle">SIMEC Store</div>

                <form id="emailForm">
                    <div class="field">
                        <label>Correo autorizado</label>
                        <input type="email" id="emailInput" class="input" placeholder="tu@simecautomation.com" autocomplete="email" required>
                    </div>
                    <button type="submit" id="btnRequestCode" class="btn btn-red btn-block">Enviar código</button>
                </form>

                <form id="codeForm" class="hidden">
                    <p style="color:#bbb;font-size:12px;text-align:center;margin:0 0 18px">
                        Enviamos un código a <br><strong id="displayEmail" style="color:#fff"></strong>
                    </p>
                    <div class="field">
                        <label>Código de 6 dígitos</label>
                        <input type="text" id="codeInput" class="input" inputmode="numeric" maxlength="6" placeholder="123456" required style="letter-spacing:8px;text-align:center;font-size:18px">
                    </div>
                    <button type="submit" id="btnLogin" class="btn btn-red btn-block">Entrar</button>
                    <button type="button" id="btnBack" class="btn btn-outline btn-block mt-2">Usar otro correo</button>
                </form>
            </div>
        </div>

        <script>
            const emailForm = document.getElementById('emailForm');
            const codeForm  = document.getElementById('codeForm');
            const emailInput = document.getElementById('emailInput');
            const codeInput  = document.getElementById('codeInput');
            const btnRequestCode = document.getElementById('btnRequestCode');
            const btnLogin = document.getElementById('btnLogin');
            const btnBack = document.getElementById('btnBack');
            const displayEmail = document.getElementById('displayEmail');
            let userEmail = '';

            emailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                userEmail = emailInput.value.trim().toLowerCase();
                btnRequestCode.classList.add('loading');
                btnRequestCode.textContent = 'Enviando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/admin/request-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail })
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('Código enviado');
                        displayEmail.textContent = userEmail;
                        emailForm.classList.add('hidden');
                        codeForm.classList.remove('hidden');
                        codeInput.focus();
                    } else {
                        window.showToast(data.error || 'Error');
                    }
                } catch (err) {
                    window.showToast('Error de conexión');
                } finally {
                    btnRequestCode.classList.remove('loading');
                    btnRequestCode.textContent = 'Enviar código';
                }
            });

            btnBack.addEventListener('click', () => {
                codeForm.classList.add('hidden');
                emailForm.classList.remove('hidden');
                codeInput.value = '';
            });

            codeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                btnLogin.classList.add('loading');
                btnLogin.textContent = 'Verificando...';
                try {
                    const r = await fetch('${STORE_MOUNT}/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, code: codeInput.value.trim() })
                    });
                    const data = await r.json();
                    if (r.ok) {
                        window.showSuccess('Acceso concedido');
                        setTimeout(() => window.location.href = '${STORE_MOUNT}/admin', 300);
                    } else {
                        window.showToast(data.error || 'Código incorrecto');
                        codeInput.select();
                        btnLogin.classList.remove('loading');
                        btnLogin.textContent = 'Entrar';
                    }
                } catch (err) {
                    window.showToast('Error de conexión');
                    btnLogin.classList.remove('loading');
                    btnLogin.textContent = 'Entrar';
                }
            });
        </script>
    `;

    return pageLayout({
        title: 'Acceso Admin — SIMEC Store',
        description: 'Panel de administración de SIMEC Store',
        headExtra: '<meta name="robots" content="noindex,nofollow">',
    }, body);
}

module.exports = { getAdminLoginHTML };
