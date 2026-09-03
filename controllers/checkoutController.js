// controllers/checkoutController.js
const { pool } = require('../config/database');
const { getPublicCheckoutHTML } = require('../views/publicCheckout');
const mp = require('../services/mercadopago');
const clientesController = require('./clientesController');
const { STORE_MOUNT } = require('../config/env');

function generarFolio() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `PED-${stamp}-${rand}`;
}

async function getCartDecorated(sesionId) {
    const c = await pool.query(`SELECT items FROM carritos WHERE sesion_id = $1`, [sesionId]);
    const items = c.rows[0]?.items || [];
    if (!items.length) return { items: [], subtotal: 0 };
    const ids = items.map(i => i.producto_id);
    const q = await pool.query(`
        SELECT p.id, p.sku, p.nombre, p.precio_lista, p.moneda, p.iva_incluido, p.activo
          FROM productos p WHERE p.id = ANY($1::int[])
    `, [ids]);
    const byId = Object.fromEntries(q.rows.map(r => [r.id, r]));
    const decorated = items
        .map(i => ({ ...i, prod: byId[i.producto_id] }))
        .filter(i => i.prod && i.prod.activo);
    const subtotal = decorated.reduce((s, i) => s + Number(i.prod.precio_lista) * i.cantidad, 0);
    return { items: decorated, subtotal, moneda: decorated[0]?.prod.moneda || 'MXN' };
}

// GET /checkout
exports.page = async (req, res) => {
    try {
        const cart = await getCartDecorated(req.sesionId);
        if (!cart.items.length) return res.redirect(`${STORE_MOUNT}/carrito`);

        // Si hay cliente con sesión activa, precargamos sus datos + última dirección
        const cliente = await clientesController.getClienteBySession(req);
        let ultimaDireccion = null;
        if (cliente) {
            const d = await pool.query(`
                SELECT calle, numero_ext, numero_int, colonia, municipio, estado, cp, referencias
                  FROM direcciones WHERE cliente_id = $1 ORDER BY id DESC LIMIT 1
            `, [cliente.id]);
            ultimaDireccion = d.rows[0] || null;
        }

        res.send(getPublicCheckoutHTML({
            cart,
            mpConfigurado: mp.configurado,
            cliente,
            ultimaDireccion,
        }));
    } catch (err) {
        console.error('checkout.page:', err);
        res.status(500).send('Error interno');
    }
};

// POST /api/checkout/confirmar
// body: {
//   contacto: { email, nombre, telefono, empresa? },
//   direccion: { calle, numero_ext, numero_int?, colonia, municipio, estado, cp, referencias? },
//   envio: { rate_id, provider, service, amount, currency, quotation_id? },
//   factura?: { requiere, rfc, razon_social, uso_cfdi, regimen, cp_fiscal },
//   notas?
// }
exports.confirmar = async (req, res) => {
    const client = await pool.connect();
    try {
        const { contacto, direccion, envio, factura, notas, crear_cuenta } = req.body;
        if (!contacto?.email || !contacto?.nombre) return res.status(400).json({ error: 'Contacto incompleto.' });
        if (!direccion?.calle || !direccion?.cp || !direccion?.estado) return res.status(400).json({ error: 'Dirección incompleta.' });
        if (!envio?.amount || envio?.amount < 0) return res.status(400).json({ error: 'Selecciona un método de envío.' });

        const cart = await getCartDecorated(req.sesionId);
        if (!cart.items.length) return res.status(400).json({ error: 'Carrito vacío.' });

        // Si viene un cliente ya logueado, respetamos su email (evita cambio de identidad)
        const clienteSesion = await clientesController.getClienteBySession(req);
        if (clienteSesion) contacto.email = clienteSesion.email;

        const subtotal = cart.subtotal;
        const envioMonto = Number(envio.amount) || 0;
        // IVA 16% sobre subtotal si los precios NO incluyen IVA
        const iva = cart.items[0].prod.iva_incluido ? 0 : subtotal * 0.16;
        const total = subtotal + envioMonto + iva;
        const moneda = cart.moneda || 'MXN';

        await client.query('BEGIN');

        // 1. Cliente (upsert por email). Si el usuario marcó "crear cuenta" activamos
        //    cuenta_activa; si ya estaba activa la mantenemos.
        const email = String(contacto.email).toLowerCase().trim();
        const activarCuenta = !!crear_cuenta || !!clienteSesion; // sesión activa implica cuenta ya activa
        const cliUp = await client.query(`
            INSERT INTO clientes (email, nombre, telefono, es_empresa, razon_social, rfc, cuenta_activa)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET
              nombre = COALESCE(EXCLUDED.nombre, clientes.nombre),
              telefono = COALESCE(EXCLUDED.telefono, clientes.telefono),
              es_empresa = COALESCE(EXCLUDED.es_empresa, clientes.es_empresa),
              razon_social = COALESCE(EXCLUDED.razon_social, clientes.razon_social),
              rfc = COALESCE(EXCLUDED.rfc, clientes.rfc),
              cuenta_activa = clientes.cuenta_activa OR EXCLUDED.cuenta_activa
            RETURNING id, cuenta_activa
        `, [
            email,
            (contacto.nombre || '').trim(),
            (contacto.telefono || '').trim() || null,
            !!contacto.empresa,
            (factura?.razon_social || contacto.empresa || '').trim() || null,
            (factura?.rfc || '').trim().toUpperCase() || null,
            activarCuenta,
        ]);
        const clienteId = cliUp.rows[0].id;
        const cuentaActivada = cliUp.rows[0].cuenta_activa && !clienteSesion && !!crear_cuenta;

        // 2. Dirección
        const dirIns = await client.query(`
            INSERT INTO direcciones (cliente_id, etiqueta, calle, numero_ext, numero_int, colonia, municipio, estado, cp, referencias)
            VALUES ($1, 'Envío', $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            clienteId,
            (direccion.calle || '').trim(),
            (direccion.numero_ext || '').trim() || null,
            (direccion.numero_int || '').trim() || null,
            (direccion.colonia || '').trim() || null,
            (direccion.municipio || '').trim() || null,
            (direccion.estado || '').trim(),
            (direccion.cp || '').trim(),
            (direccion.referencias || '').trim() || null,
        ]);
        const direccionId = dirIns.rows[0].id;

        // 3. Pedido
        const folio = generarFolio();
        const cfdiReceptor = factura?.requiere ? {
            rfc: (factura.rfc || '').toUpperCase().trim(),
            razon_social: (factura.razon_social || '').trim(),
            uso_cfdi: factura.uso_cfdi || 'G03',
            regimen: factura.regimen || '616',
            cp_fiscal: (factura.cp_fiscal || '').trim(),
        } : null;

        const pedIns = await client.query(`
            INSERT INTO pedidos (
                folio, cliente_id, direccion_envio_id, estatus,
                subtotal, envio, iva, total, moneda,
                transportista, servicio_envio,
                requiere_factura, cfdi_uso, cfdi_receptor, notas
            ) VALUES (
                $1, $2, $3, 'pendiente_pago',
                $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13::jsonb, $14
            ) RETURNING id
        `, [
            folio, clienteId, direccionId,
            subtotal, envioMonto, iva, total, moneda,
            envio.provider || null, envio.service || null,
            !!factura?.requiere,
            factura?.uso_cfdi || null,
            cfdiReceptor ? JSON.stringify(cfdiReceptor) : null,
            (notas || '').trim() || null,
        ]);
        const pedidoId = pedIns.rows[0].id;

        // 4. Snapshot de items del pedido
        for (const it of cart.items) {
            await client.query(`
                INSERT INTO pedido_items (pedido_id, producto_id, sku_snapshot, nombre_snapshot, cantidad, precio_unit, precio_total)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                pedidoId, it.producto_id, it.prod.sku, it.prod.nombre, it.cantidad,
                it.prod.precio_lista, Number(it.prod.precio_lista) * it.cantidad,
            ]);
        }

        // Guardamos el quotation_id de Skydropx en notas si vino, para usar al generar la guía
        if (envio.quotation_id || envio.rate_id) {
            await client.query(`
                UPDATE pedidos
                   SET notas = COALESCE(notas, '') ||
                       CASE WHEN notas IS NULL OR notas = '' THEN '' ELSE E'\\n' END ||
                       $1
                 WHERE id = $2
            `, [
                `[shipping] quotation_id=${envio.quotation_id || ''} rate_id=${envio.rate_id || ''} demo=${!!envio.demo}`,
                pedidoId,
            ]);
        }

        await client.query('COMMIT');

        // 5. Crear preferencia MP
        if (!mp.configurado) {
            return res.status(503).json({
                error: 'Mercado Pago aún no está configurado. Agrega MP_ACCESS_TOKEN en .env y reinicia.',
                folio,
            });
        }

        const items = cart.items.map(it => ({
            title: `${it.prod.nombre} — ${it.prod.sku}`,
            quantity: it.cantidad,
            unit_price: Number(it.prod.precio_lista) * (it.prod.iva_incluido ? 1 : 1.16),
            currency_id: moneda,
        }));

        const pref = await mp.crearPreferencia({
            folio,
            items,
            shipping: envioMonto,
            payerEmail: email,
            notasInternas: notas || '',
        });

        await pool.query(`UPDATE pedidos SET mp_preference_id = $1 WHERE id = $2`, [pref.id, pedidoId]);

        res.json({ ok: true, folio, init_point: pref.init_point, cuenta_creada: cuentaActivada });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('checkout.confirmar:', err);
        res.status(500).json({ error: err.message || 'Error confirmando pedido.' });
    } finally {
        client.release();
    }
};
