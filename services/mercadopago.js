// services/mercadopago.js
// Envuelve el SDK oficial. Si no hay token configurado, expone `configurado=false`
// para que el checkout responda con un error claro en lugar de fallar en runtime.
const { MP, BASE_URL, STORE_MOUNT } = require('../config/env');

let mpClient = null;
if (MP.accessToken) {
    try {
        const { MercadoPagoConfig } = require('mercadopago');
        mpClient = new MercadoPagoConfig({ accessToken: MP.accessToken, options: { timeout: 8000 } });
    } catch (err) {
        console.warn('No se pudo inicializar Mercado Pago SDK:', err.message);
    }
}

const configurado = !!mpClient;

/**
 * Crea una preferencia de Checkout Pro. Devuelve { init_point, id }.
 * items: [{ title, quantity, unit_price, currency_id }]
 */
async function crearPreferencia({ folio, items, shipping = 0, payerEmail, notasInternas = '' }) {
    if (!configurado) throw new Error('Mercado Pago no está configurado (falta MP_ACCESS_TOKEN).');
    const { Preference } = require('mercadopago');
    const pref = new Preference(mpClient);

    const backBase = `${BASE_URL}${STORE_MOUNT}/pedido/${folio}`;
    const body = {
        items: items.map(it => ({
            title: it.title.slice(0, 250),
            quantity: it.quantity,
            unit_price: Number(it.unit_price),
            currency_id: it.currency_id || 'MXN',
        })),
        shipments: shipping > 0 ? {
            cost: Number(shipping),
            mode: 'not_specified',
        } : undefined,
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: folio,
        statement_descriptor: 'SIMEC STORE',
        notification_url: `${BASE_URL}${STORE_MOUNT}/api/mp/webhook`,
        back_urls: {
            success: `${backBase}?estatus=aprobado`,
            failure: `${backBase}?estatus=rechazado`,
            pending: `${backBase}?estatus=pendiente`,
        },
        auto_return: 'approved',
        metadata: { folio, notas: notasInternas },
    };

    const res = await pref.create({ body });
    // En sandbox, MP devuelve sandbox_init_point; en prod, init_point.
    return {
        id: res.id,
        init_point: res.init_point || res.sandbox_init_point,
    };
}

async function obtenerPago(paymentId) {
    if (!configurado) throw new Error('Mercado Pago no está configurado.');
    const { Payment } = require('mercadopago');
    const pay = new Payment(mpClient);
    return await pay.get({ id: paymentId });
}

module.exports = { configurado, crearPreferencia, obtenerPago };
