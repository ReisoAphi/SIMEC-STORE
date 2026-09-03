// services/emails.js
// Plantillas HTML centralizadas y envoltura común (marca SIMEC).
const { transporter, MAIL_FROM, SALES_INBOX } = require('../config/mailer');
const { STORE_MOUNT, BASE_URL } = require('../config/env');

function money(n, moneda = 'MXN') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(n) || 0);
}

function wrap(inner) {
    return `
    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px 15px">
        <div style="background:#ffffff;max-width:600px;margin:0 auto;padding:0;border-top:4px solid #D90000;box-shadow:0 4px 12px rgba(0,0,0,.08)">
            <div style="padding:20px 30px;background:#000000;color:#fff">
                <strong style="letter-spacing:2px;font-size:14px"><span style="color:#D90000">SIMEC</span> STORE</strong>
            </div>
            <div style="padding:30px">${inner}</div>
            <div style="padding:15px 30px;background:#fafafa;color:#888;font-size:11px;text-align:center">
                SIMEC Automation · <a href="${BASE_URL}${STORE_MOUNT}" style="color:#D90000">Tienda en línea</a>
            </div>
        </div>
    </div>
    `;
}

async function enviarConfirmacionPedido(pedido, itemsAux, correoDestino) {
    if (!correoDestino) return;
    const url = `${BASE_URL}${STORE_MOUNT}/pedido/${pedido.folio}`;
    const filas = itemsAux.map(it => `
        <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #eee">
                <div>${it.nombre_snapshot}</div>
                <div style="color:#888;font-family:monospace;font-size:11px">${it.sku_snapshot} × ${it.cantidad}</div>
            </td>
            <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right"><strong>${money(it.precio_total, pedido.moneda)}</strong></td>
        </tr>
    `).join('');

    await transporter.sendMail({
        from: MAIL_FROM, to: correoDestino,
        subject: `Pedido ${pedido.folio} confirmado — SIMEC Store`,
        html: wrap(`
            <h2 style="color:#333;margin:0 0 10px">¡Gracias por tu compra!</h2>
            <p style="color:#555">Tu pago fue confirmado. Estamos preparando tu pedido.</p>
            <p><strong>Folio:</strong> ${pedido.folio}</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0">
                <tbody>${filas}</tbody>
                <tfoot>
                    <tr><td style="padding:6px;color:#888">Subtotal</td><td style="padding:6px;text-align:right">${money(pedido.subtotal, pedido.moneda)}</td></tr>
                    <tr><td style="padding:6px;color:#888">Envío</td><td style="padding:6px;text-align:right">${money(pedido.envio, pedido.moneda)}</td></tr>
                    <tr><td style="padding:6px;color:#888">IVA</td><td style="padding:6px;text-align:right">${money(pedido.iva, pedido.moneda)}</td></tr>
                    <tr><td style="padding:8px 6px;color:#000;font-size:16px"><strong>Total</strong></td><td style="padding:8px 6px;text-align:right;color:#D90000;font-size:16px"><strong>${money(pedido.total, pedido.moneda)}</strong></td></tr>
                </tfoot>
            </table>
            <p style="text-align:center;margin:24px 0"><a href="${url}" style="background:#D90000;color:#fff;padding:12px 28px;text-decoration:none;font-weight:bold;letter-spacing:1px">Ver estatus del pedido</a></p>
            <p style="color:#888;font-size:12px">Te enviaremos otro correo cuando tu paquete salga con el número de guía.</p>
        `),
    });
}

async function enviarNotificacionEquipo(pedido) {
    await transporter.sendMail({
        from: MAIL_FROM, to: SALES_INBOX,
        subject: `[Pagado] Pedido ${pedido.folio} — ${money(pedido.total, pedido.moneda)}`,
        html: wrap(`
            <h2 style="margin:0 0 10px">Nuevo pedido pagado</h2>
            <p><strong>Folio:</strong> ${pedido.folio}</p>
            <p><strong>Total:</strong> ${money(pedido.total, pedido.moneda)}</p>
            <p><a href="${BASE_URL}${STORE_MOUNT}/admin/pedidos/${pedido.id}" style="color:#D90000">Ver en admin →</a></p>
        `),
    });
}

async function enviarEnvioListo(pedido, correoDestino) {
    if (!correoDestino) return;
    await transporter.sendMail({
        from: MAIL_FROM, to: correoDestino,
        subject: `Tu pedido ${pedido.folio} ya está en camino`,
        html: wrap(`
            <h2 style="margin:0 0 10px">🚚 Tu paquete ya está en camino</h2>
            <p>Tu pedido <strong>${pedido.folio}</strong> ya salió del almacén.</p>
            ${pedido.transportista ? `<p><strong>Transportista:</strong> ${pedido.transportista} — ${pedido.servicio_envio || ''}</p>` : ''}
            ${pedido.guia ? `<p><strong>Guía:</strong> <code>${pedido.guia}</code></p>` : ''}
            ${pedido.tracking_url ? `<p style="text-align:center;margin:24px 0"><a href="${pedido.tracking_url}" style="background:#D90000;color:#fff;padding:12px 28px;text-decoration:none;font-weight:bold">Rastrear envío</a></p>` : ''}
        `),
    });
}

async function enviarFactura(pedido, correoDestino, pdfBuffer, xmlBuffer, pdfName, xmlName) {
    if (!correoDestino) return;
    await transporter.sendMail({
        from: MAIL_FROM, to: correoDestino,
        subject: `Factura CFDI — Pedido ${pedido.folio}`,
        html: wrap(`
            <h2 style="margin:0 0 10px">📄 Tu factura está lista</h2>
            <p>Adjunto encontrarás la factura CFDI 4.0 correspondiente a tu pedido <strong>${pedido.folio}</strong>.</p>
            <p><strong>Total facturado:</strong> ${money(pedido.total, pedido.moneda)}</p>
        `),
        attachments: [
            { filename: pdfName || `factura-${pedido.folio}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
            { filename: xmlName || `factura-${pedido.folio}.xml`, content: xmlBuffer, contentType: 'application/xml' },
        ],
    });
}

module.exports = {
    money, wrap,
    enviarConfirmacionPedido,
    enviarNotificacionEquipo,
    enviarEnvioListo,
    enviarFactura,
};
