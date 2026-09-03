// views/styles.js
// Estilo global de SIMEC-STORE. Alineado a la paleta corporativa de
// SIMEC-VALIDATIONS (rojo #D90000 sobre negro con acentos ámbar/verde).
// Este bloque se inyecta en <head> de todas las páginas.

const simecStoreStyles = `
<style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

    :root {
        --primary-red: #D90000;
        --primary-red-dark: #a70000;
        --bg-black: #000000;
        --bg-dark: #080808;
        --bg-panel: #121212;
        --bg-panel-2: #181818;
        --bg-panel-3: #1f1f1f;
        --border: #2a2a2a;
        --border-strong: #3a3a3a;
        --text-main: #ffffff;
        --text-mid: #bfbfbf;
        --text-soft: #8a8a8a;
        --accent-green: #28a745;
        --accent-gold: #FFC107;
        --accent-blue: #17a2b8;
        --header-height: 64px;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg-dark); color: var(--text-main); font-family: 'Montserrat', system-ui, sans-serif; font-size: 14px; line-height: 1.5; }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; display: block; }
    button { font-family: inherit; }

    /* --------- Header --------- */
    .simec-header {
        background: #000; height: var(--header-height);
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 24px; border-bottom: 2px solid #1a1a1a;
        position: sticky; top: 0; z-index: 1000;
    }
    .simec-header .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 15px; }
    .simec-header .brand .logo-red { color: var(--primary-red); }
    .simec-header nav { display: flex; align-items: center; gap: 24px; }
    .simec-header nav a { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #ccc; font-weight: 600; transition: color .2s; }
    .simec-header nav a:hover { color: var(--primary-red); }
    .simec-header .actions { display: flex; align-items: center; gap: 10px; }

    /* --------- Buttons --------- */
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 18px; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: .5px; border: 1px solid transparent; cursor: pointer; transition: all .2s; text-decoration: none; border-radius: 2px; }
    .btn-red { background: var(--primary-red); color: #fff; }
    .btn-red:hover { background: var(--primary-red-dark); }
    .btn-green { background: var(--accent-green); color: #fff; }
    .btn-green:hover { background: #218838; }
    .btn-gold { background: var(--accent-gold); color: #000; }
    .btn-gold:hover { background: #e0a800; }
    .btn-outline { background: transparent; color: #ddd; border-color: var(--border-strong); }
    .btn-outline:hover { border-color: var(--primary-red); color: #fff; }
    .btn-ghost { background: transparent; color: #ddd; border-color: transparent; }
    .btn-ghost:hover { color: var(--primary-red); }
    .btn-sm { padding: 6px 12px; font-size: 11px; }
    .btn-lg { padding: 14px 26px; font-size: 13px; }
    .btn-block { width: 100%; }
    .btn:disabled, .btn.loading { opacity: .55; pointer-events: none; }

    /* --------- Layout --------- */
    .container { max-width: 1280px; margin: 0 auto; padding: 0 20px; }
    .container-narrow { max-width: 900px; margin: 0 auto; padding: 0 20px; }
    .stack > * + * { margin-top: 16px; }

    /* --------- Forms --------- */
    .input, .select, .textarea {
        width: 100%; padding: 12px 14px; background: var(--bg-panel-2);
        border: 1px solid var(--border); color: #fff;
        font: inherit; font-size: 14px; border-radius: 2px;
    }
    .select { cursor: pointer; }
    .textarea { min-height: 100px; resize: vertical; }
    .input:focus, .select:focus, .textarea:focus { outline: none; border-color: var(--primary-red); }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-soft); font-weight: 600; }
    .field .help { font-size: 11px; color: var(--text-soft); }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 640px) { .field-row { grid-template-columns: 1fr; } }

    /* --------- Card / Panel --------- */
    .panel { background: var(--bg-panel); border: 1px solid var(--border); padding: 24px; }
    .panel-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-soft); margin: 0 0 16px; font-weight: 700; }

    /* --------- Badges --------- */
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: .5px; border-radius: 2px; }
    .badge-in-stock { background: rgba(40,167,69,.15); color: var(--accent-green); border: 1px solid rgba(40,167,69,.4); }
    .badge-low-stock { background: rgba(255,193,7,.15); color: var(--accent-gold); border: 1px solid rgba(255,193,7,.4); }
    .badge-quote { background: rgba(23,162,184,.15); color: var(--accent-blue); border: 1px solid rgba(23,162,184,.4); }
    .badge-out { background: rgba(255,255,255,.06); color: var(--text-soft); border: 1px solid var(--border-strong); }

    /* --------- Product grid --------- */
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .product-card { background: var(--bg-panel); border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; transition: transform .2s, border-color .2s; }
    .product-card:hover { transform: translateY(-2px); border-color: var(--primary-red); }
    .product-card .thumb { aspect-ratio: 1/1; background: #0d0d0d; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .product-card .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .product-card .body { padding: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .product-card .sku { font-size: 10px; color: var(--text-soft); text-transform: uppercase; letter-spacing: 1px; }
    .product-card .title { font-size: 13px; font-weight: 600; color: #fff; margin: 0; }
    .product-card .price { font-size: 16px; font-weight: 800; color: var(--primary-red); margin-top: auto; }
    .product-card .foot { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-top: 1px solid var(--border); }

    /* --------- Admin sidebar layout --------- */
    .admin-shell { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - var(--header-height)); }
    .admin-sidebar { background: var(--bg-panel); border-right: 1px solid var(--border); padding: 20px 0; }
    .admin-sidebar .group { padding: 10px 20px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-soft); font-weight: 700; }
    .admin-sidebar a { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 13px; color: #ccc; border-left: 3px solid transparent; }
    .admin-sidebar a:hover { background: var(--bg-panel-2); color: #fff; }
    .admin-sidebar a.active { border-left-color: var(--primary-red); color: #fff; background: var(--bg-panel-2); }
    .admin-main { padding: 28px 32px; overflow: auto; }
    .admin-main h1 { font-size: 22px; margin: 0 0 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    @media (max-width: 900px) { .admin-shell { grid-template-columns: 1fr; } .admin-sidebar { display: none; } }

    /* --------- Data table --------- */
    .table { width: 100%; border-collapse: collapse; background: var(--bg-panel); border: 1px solid var(--border); }
    .table th, .table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
    .table th { background: var(--bg-panel-2); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-soft); font-weight: 700; }
    .table tr:hover td { background: var(--bg-panel-2); }
    .table td .row-actions { display: flex; gap: 8px; }
    .empty-state { padding: 48px 24px; text-align: center; color: var(--text-soft); border: 1px dashed var(--border-strong); background: var(--bg-panel); }
    .empty-state h3 { color: #fff; margin: 0 0 8px; }

    /* --------- Toolbar --------- */
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .toolbar .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    /* --------- Modal --------- */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 3000; }
    .modal-overlay.open { display: flex; }
    .modal-box { background: var(--bg-panel); border: 1px solid var(--border); border-top: 3px solid var(--primary-red); padding: 28px; width: 92%; max-width: 520px; max-height: 90vh; overflow: auto; }
    .modal-box h3 { margin: 0 0 16px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }

    /* --------- Toasts --------- */
    #toast, #toast-success { position: fixed; top: 30px; left: 50%; transform: translateX(-50%); padding: 14px 22px; font-weight: 600; font-size: 13px; border-radius: 3px; z-index: 6000; opacity: 0; pointer-events: none; transition: opacity .3s, top .3s; box-shadow: 0 8px 24px rgba(0,0,0,.6); }
    #toast { background: var(--primary-red); color: #fff; }
    #toast-success { background: var(--accent-green); color: #fff; }
    #toast.show, #toast-success.show { opacity: 1; top: 80px; pointer-events: auto; }

    /* --------- Login card --------- */
    .auth-wrap { min-height: calc(100vh - var(--header-height)); display: flex; align-items: center; justify-content: center; background: linear-gradient(rgba(0,0,0,.85),rgba(0,0,0,.9)), url('https://simecautomation.com/wp-content/uploads/2021/08/slider-1.jpg') center/cover no-repeat; padding: 40px 20px; }
    .auth-card { background: rgba(10,10,10,.95); border: 1px solid var(--border); border-top: 3px solid var(--primary-red); padding: 40px; width: 100%; max-width: 400px; }
    .auth-card h1 { margin: 0 0 6px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
    .auth-card .subtitle { text-align: center; color: var(--text-soft); font-size: 12px; margin-bottom: 28px; }

    /* --------- Footer --------- */
    .simec-footer { border-top: 1px solid var(--border); padding: 32px 20px; color: var(--text-soft); font-size: 12px; text-align: center; margin-top: 60px; background: #050505; }
    .simec-footer a { color: var(--text-mid); }
    .simec-footer a:hover { color: var(--primary-red); }

    /* --------- Utilities --------- */
    .text-red { color: var(--primary-red); }
    .text-soft { color: var(--text-soft); }
    .text-right { text-align: right; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
    .mt-2 { margin-top: 8px; } .mt-4 { margin-top: 16px; } .mt-6 { margin-top: 24px; }
    .hidden { display: none !important; }

    /* --------- Spinner --------- */
    .spinner { width: 22px; height: 22px; border: 3px solid rgba(255,255,255,.15); border-top-color: var(--primary-red); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
</style>
`;

const toastMarkup = `
<div id="toast">Error</div>
<div id="toast-success">OK</div>
<script>
window.showToast = function(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),4000); };
window.showSuccess = function(msg){ const t=document.getElementById('toast-success'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),4000); };
</script>
`;

module.exports = { simecStoreStyles, toastMarkup };
