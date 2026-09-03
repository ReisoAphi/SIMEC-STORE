// services/facturama.js
// Cliente ligero de Facturama para emisión de CFDI 4.0 (Ingreso).
// Autentica con HTTP Basic (FACTURAMA_USER:FACTURAMA_PASS).
// Si no está configurado, expone `configurado=false` para que el flujo
// de pago siga funcionando y el admin pueda facturar manualmente.
const { FACTURAMA } = require('../config/env');

const configurado = !!(FACTURAMA.user && FACTURAMA.pass && FACTURAMA.emisorRfc);

function authHeader() {
    const b64 = Buffer.from(`${FACTURAMA.user}:${FACTURAMA.pass}`).toString('base64');
    return `Basic ${b64}`;
}

// Mapea la forma de pago de Mercado Pago al catálogo SAT (c_FormaPago).
function mapFormaPago(mpPaymentTypeId) {
    switch (mpPaymentTypeId) {
        case 'credit_card':   return '04'; // Tarjeta de crédito
        case 'debit_card':    return '28'; // Tarjeta de débito
        case 'bank_transfer': return '03'; // Transferencia electrónica (SPEI)
        case 'ticket':        return '01'; // Efectivo (OXXO)
        case 'account_money': return '05'; // Monedero electrónico
        default:              return '99'; // Por definir
    }
}

/**
 * Genera un CFDI 4.0 de tipo Ingreso.
 * pedido: registro de tabla pedidos (con receptor: rfc/razon_social/uso_cfdi/regimen/cp_fiscal)
 * items: [{ sku, nombre, cantidad, precio_unit, iva_incluido }]
 * mpPago: objeto de MP (opcional, para mapear la forma de pago)
 */
async function crearCFDI({ pedido, items, receptor, mpPago }) {
    if (!configurado) throw new Error('Facturama no está configurado (falta FACTURAMA_USER/PASS/EMISOR_RFC).');

    const formaPago = mapFormaPago(mpPago?.payment_type_id);
    const expedicionCP = FACTURAMA.emisorLugarExpedicion || '66600';

    // Calculamos importes: si el precio incluye IVA, hay que separarlo
    const subtotalRedondeo = (n) => Math.round(Number(n) * 100) / 100;
    const cfdiItems = items.map(it => {
        const cant = Number(it.cantidad);
        const punit = Number(it.precio_unit);
        // Suponemos que los precios del pedido son SIN IVA (checkout ya agregó 16% al total del pedido).
        // Si necesitas emitir con IVA incluido, ajusta el flag en el producto.
        const subtotalItem = subtotalRedondeo(punit * cant);
        const ivaItem = subtotalRedondeo(subtotalItem * 0.16);
        const totalItem = subtotalRedondeo(subtotalItem + ivaItem);
        return {
            ProductCode: '01010101', // "No existe en el catálogo" — cambia si tienes clave SAT específica
            IdentificationNumber: it.sku_snapshot || it.sku,
            Description: (it.nombre_snapshot || it.nombre || '').slice(0, 300),
            Unit: 'PIEZA',
            UnitCode: 'H87',
            Quantity: cant,
            UnitPrice: punit,
            Subtotal: subtotalItem,
            Taxes: [{
                Total: ivaItem,
                Name: 'IVA',
                Base: subtotalItem,
                Rate: 0.16,
                IsRetention: false,
                IsFederalTax: true,
            }],
            Total: totalItem,
        };
    });

    const subtotal = subtotalRedondeo(cfdiItems.reduce((s, it) => s + it.Subtotal, 0));
    const iva = subtotalRedondeo(cfdiItems.reduce((s, it) => s + (it.Taxes[0]?.Total || 0), 0));
    const total = subtotalRedondeo(subtotal + iva);

    const body = {
        NameId: '1',
        CfdiType: 'I',
        PaymentForm: formaPago,
        PaymentMethod: 'PUE', // Pago en una sola exhibición
        ExpeditionPlace: expedicionCP,
        Currency: pedido.moneda || 'MXN',
        Folio: pedido.folio.slice(-8),
        Issuer: {
            FiscalRegime: FACTURAMA.emisorRegimen || '601',
            Rfc: FACTURAMA.emisorRfc,
            Name: (process.env.EMISOR_NOMBRE || 'SIMEC AUTOMATION').toUpperCase(),
        },
        Receiver: {
            Rfc: (receptor.rfc || 'XAXX010101000').toUpperCase().trim(),
            Name: (receptor.razon_social || 'PUBLICO EN GENERAL').toUpperCase().trim(),
            CfdiUse: receptor.uso_cfdi || 'G03',
            FiscalRegime: receptor.regimen || '616',
            TaxZipCode: receptor.cp_fiscal || pedido.cp || '66600',
        },
        Items: cfdiItems,
        Subtotal: subtotal,
        Total: total,
    };

    const r = await fetch(`${FACTURAMA.baseUrl}/3/cfdis`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader(),
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`Facturama ${r.status}: ${txt.slice(0, 400)}`);
    }
    const data = await r.json();
    return {
        id: data.Id,
        uuid: data?.Complement?.TaxStamp?.Uuid || null,
        // Ambos endpoints entregan el archivo en base64 → los generamos on-demand
        pdf_endpoint: `${FACTURAMA.baseUrl}/cfdi/pdf/issued/${data.Id}`,
        xml_endpoint: `${FACTURAMA.baseUrl}/cfdi/xml/issued/${data.Id}`,
        raw: data,
    };
}

// Descarga PDF/XML del CFDI y devuelve { buffer, contentType, filename }
async function descargarCFDI(cfdiId, tipo = 'pdf') {
    if (!configurado) throw new Error('Facturama no está configurado.');
    const endpoint = tipo === 'xml'
        ? `${FACTURAMA.baseUrl}/cfdi/xml/issued/${cfdiId}`
        : `${FACTURAMA.baseUrl}/cfdi/pdf/issued/${cfdiId}`;
    const r = await fetch(endpoint, { headers: { 'Authorization': authHeader() } });
    if (!r.ok) throw new Error(`Facturama descarga ${tipo} ${r.status}`);
    const data = await r.json();
    const buffer = Buffer.from(data.Content, 'base64');
    return {
        buffer,
        contentType: tipo === 'xml' ? 'application/xml' : 'application/pdf',
        filename: `${data.Name || 'cfdi-' + cfdiId}.${tipo}`,
    };
}

module.exports = { configurado, crearCFDI, descargarCFDI };
