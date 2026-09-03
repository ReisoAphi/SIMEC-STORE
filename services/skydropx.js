// services/skydropx.js
// Cliente ligero de Skydropx v1 (multi-carrier: DHL, FedEx, Estafeta, Redpack,
// Paquetexpress...). Autentica con client_credentials y cachea el token.
// Si no hay credenciales configuradas, devuelve tarifas MOCK para que el
// checkout sea navegable en desarrollo — se marca `demo: true` en cada rate.
const { SKYDROPX, ORIGEN } = require('../config/env');

let cachedToken = null; // { access_token, expires_at }

async function getToken() {
    if (!SKYDROPX.clientId || !SKYDROPX.clientSecret) return null;
    if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
        return cachedToken.access_token;
    }
    const r = await fetch(`${SKYDROPX.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: SKYDROPX.clientId,
            client_secret: SKYDROPX.clientSecret,
        }),
    });
    if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`Skydropx auth ${r.status}: ${txt.slice(0, 200)}`);
    }
    const data = await r.json();
    cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return cachedToken.access_token;
}

/**
 * Cotiza envío a partir de un CP destino y una lista de paquetes.
 * paquetes: [{ peso_kg, largo_cm, ancho_cm, alto_cm }]
 * Devuelve: { rates: [{ id, provider, service, amount, currency, days, demo? }], demo? }
 */
async function cotizar({ cpDestino, paquetes }) {
    if (!cpDestino) throw new Error('CP destino requerido.');

    // Consolidamos paquetes: para MVP mandamos uno solo con la suma de pesos y
    // las dimensiones del paquete mayor (mejora futura: split en varios bultos).
    const totalPeso = paquetes.reduce((s, p) => s + Math.max(0.1, Number(p.peso_kg) || 0.1), 0);
    const maxDim = paquetes.reduce((m, p) => ({
        largo: Math.max(m.largo, Number(p.largo_cm) || 10),
        ancho: Math.max(m.ancho, Number(p.ancho_cm) || 10),
        alto: Math.max(m.alto, Number(p.alto_cm) || 10),
    }), { largo: 10, ancho: 10, alto: 10 });

    const token = await getToken();
    if (!token) return mockRates(totalPeso);

    try {
        const body = {
            address_from: {
                country_code: 'MX',
                postal_code: ORIGEN.cp,
                area_level1: ORIGEN.estado,
                area_level2: ORIGEN.ciudad,
            },
            address_to: {
                country_code: 'MX',
                postal_code: cpDestino,
            },
            parcels: [{
                length: maxDim.largo,
                width: maxDim.ancho,
                height: maxDim.alto,
                weight: totalPeso,
            }],
        };
        const r = await fetch(`${SKYDROPX.baseUrl}/quotations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        if (!r.ok) {
            const txt = await r.text().catch(() => '');
            console.warn(`Skydropx quote ${r.status}: ${txt.slice(0, 300)}`);
            return mockRates(totalPeso);
        }
        const data = await r.json();
        // Estructura esperada: { id, rates: [{ id, provider_name, provider_service_name, total_pricing, currency, days }] }
        const rates = (data.rates || data.data?.rates || []).map(rt => ({
            id: rt.id,
            provider: rt.provider_name || rt.provider || 'Paquetería',
            service: rt.provider_service_name || rt.service || 'Estándar',
            amount: Number(rt.total_pricing || rt.amount || 0),
            currency: rt.currency || 'MXN',
            days: rt.days || rt.estimated_delivery_days || null,
        })).filter(r => r.amount > 0)
          .sort((a, b) => a.amount - b.amount);
        return { rates, quotation_id: data.id, demo: false };
    } catch (err) {
        console.warn('Skydropx cotizar error:', err.message);
        return mockRates(totalPeso);
    }
}

// Rates de demostración (cuando no hay credenciales o falla la API).
// Basadas en tarifas aproximadas por peso para que la UX se pueda probar.
function mockRates(pesoKg) {
    const kg = Math.max(1, Math.ceil(pesoKg));
    const base = 120 + kg * 25;
    return {
        rates: [
            { id: 'demo-estafeta', provider: 'Estafeta', service: 'Terrestre', amount: Math.round(base * 0.85), currency: 'MXN', days: '3-5', demo: true },
            { id: 'demo-fedex',    provider: 'FedEx',    service: 'Express Saver', amount: Math.round(base * 1.10), currency: 'MXN', days: '2-3', demo: true },
            { id: 'demo-dhl',      provider: 'DHL',      service: 'Express',       amount: Math.round(base * 1.45), currency: 'MXN', days: '1-2', demo: true },
        ],
        demo: true,
    };
}

/**
 * Crea el envío real (guía) tras el pago. Devuelve { guia, tracking_url, ... }.
 * Si no hay credenciales o falla, devuelve un objeto stub para que el pedido
 * no se rompa — el admin generará la guía manualmente.
 */
async function crearEnvio({ quotation_id, rate_id }) {
    const token = await getToken();
    if (!token || !quotation_id || !rate_id) {
        return { guia: null, tracking_url: null, stub: true };
    }
    try {
        const r = await fetch(`${SKYDROPX.baseUrl}/shipments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ quotation_id, rate_id }),
        });
        if (!r.ok) {
            console.warn('Skydropx crearEnvio', r.status, await r.text().catch(()=>''));
            return { guia: null, tracking_url: null, stub: true };
        }
        const data = await r.json();
        return {
            guia: data.tracking_number || data.guide_number || data.id,
            tracking_url: data.tracking_url || null,
            label_url: data.label_url || null,
            stub: false,
            raw: data,
        };
    } catch (err) {
        console.warn('Skydropx crearEnvio error:', err.message);
        return { guia: null, tracking_url: null, stub: true };
    }
}

module.exports = { cotizar, crearEnvio, mockRates };
