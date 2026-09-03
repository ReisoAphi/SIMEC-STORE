// controllers/pagosController.js
const { pool } = require('../config/database');
const mp = require('../services/mercadopago');
const { crearEnvio } = require('../services/skydropx');
const facturama = require('../services/facturama');
const emails = require('../services/emails');
const { getPublicPedidoHTML } = require('../views/publicPedido');

// GET /pedido/:folio — pantalla pública de estatus
exports.pedido = async (req, res) => {
    try {
        const folio = req.params.folio;
        const q = await pool.query(`
            SELECT p.*, c.email, c.nombre AS cliente_nombre,
                   d.calle, d.numero_ext, d.numero_int, d.colonia, d.municipio, d.estado, d.cp
              FROM pedidos p
         LEFT JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN direcciones d ON d.id = p.direccion_envio_id
             WHERE p.folio = $1
        `, [folio]);
        if (q.rows.length === 0) return res.status(404).send('Pedido no encontrado');
        const pedido = q.rows[0];
        const items = await pool.query(`SELECT * FROM pedido_items WHERE pedido_id = $1 ORDER BY id`, [pedido.id]);
        pedido.items = items.rows;
        res.send(getPublicPedidoHTML({ pedido, estatusQuery: req.query.estatus || null }));
    } catch (err) {
        console.error('pagos.pedido:', err);
        res.status(500).send('Error interno');
    }
};

// POST /api/mp/webhook  y  GET /api/mp/webhook (MP a veces manda por query)
exports.webhook = async (req, res) => {
    try {
        const type = req.body?.type || req.query?.type || req.body?.topic || req.query?.topic;
        const paymentId = req.body?.data?.id || req.query?.id || req.query?.['data.id'];
        if (type !== 'payment' || !paymentId) return res.status(200).send('ok');
        if (!mp.configurado) return res.status(200).send('ok');

        const pago = await mp.obtenerPago(paymentId);
        const folio = pago.external_reference;
        if (!folio) return res.status(200).send('ok');

        const q = await pool.query(`SELECT * FROM pedidos WHERE folio = $1`, [folio]);
        if (q.rows.length === 0) return res.status(200).send('ok');
        const pedido = q.rows[0];

        // Idempotencia
        if (['pagado', 'empacando', 'enviado', 'entregado'].includes(pedido.estatus)) {
            return res.status(200).send('ok');
        }

        if (pago.status === 'approved') {
            await marcarPagado(pedido, String(paymentId), pago);
        } else if (['rejected', 'cancelled'].includes(pago.status)) {
            await pool.query(`UPDATE pedidos SET estatus='cancelado', actualizado_en=NOW() WHERE id=$1`, [pedido.id]);
        }
        res.status(200).send('ok');
    } catch (err) {
        console.error('pagos.webhook:', err);
        res.status(200).send('ok'); // MP reintenta ante 5xx
    }
};

async function marcarPagado(pedido, mpPaymentId, mpPago) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            UPDATE pedidos
               SET estatus='pagado',
                   mp_payment_id=$1,
                   mp_payment_method=$2,
                   actualizado_en=NOW()
             WHERE id=$3
        `, [mpPaymentId, mpPago?.payment_type_id || null, pedido.id]);

        // Decrementa inventario
        const items = await client.query(`SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id=$1`, [pedido.id]);
        for (const it of items.rows) {
            const alm = await client.query(`
                SELECT almacen_id FROM inventario
                 WHERE producto_id=$1
              ORDER BY (stock_disponible - stock_reservado) DESC
                 LIMIT 1
            `, [it.producto_id]);
            const almacenId = alm.rows[0]?.almacen_id || 1;
            await client.query(`
                UPDATE inventario
                   SET stock_disponible = GREATEST(stock_disponible - $1, 0),
                       stock_reservado  = GREATEST(stock_reservado  - $1, 0),
                       actualizado_en   = NOW()
                 WHERE producto_id=$2 AND almacen_id=$3
            `, [it.cantidad, it.producto_id, almacenId]);
            await client.query(`
                INSERT INTO movimientos_inventario (producto_id, almacen_id, delta, motivo, referencia, usuario_email)
                VALUES ($1, $2, $3, 'venta', $4, 'sistema')
            `, [it.producto_id, almacenId, -it.cantidad, `Pedido ${pedido.folio}`]);
        }
        await client.query('COMMIT');

        // Envío real vía Skydropx (best-effort)
        let pedidoActualizado = pedido;
        try {
            const m = /\[shipping\] quotation_id=([\w-]*) rate_id=([\w-]*)/.exec(pedido.notas || '');
            const quotation_id = m?.[1] || null;
            const rate_id = m?.[2] || null;
            if (quotation_id && rate_id && !rate_id.startsWith('demo-')) {
                const env = await crearEnvio({ quotation_id, rate_id });
                if (env.guia) {
                    await pool.query(`
                        UPDATE pedidos SET guia=$1, tracking_url=$2, estatus='empacando', actualizado_en=NOW()
                         WHERE id=$3
                    `, [env.guia, env.tracking_url || null, pedido.id]);
                    pedidoActualizado = { ...pedido, guia: env.guia, tracking_url: env.tracking_url, estatus: 'empacando' };
                }
            }
        } catch (e) { console.warn('crearEnvio:', e.message); }

        // Facturación (best-effort)
        let facturaAdjuntos = null;
        if (pedido.requiere_factura && pedido.cfdi_receptor && facturama.configurado) {
            try {
                const itemsQ = await pool.query(`SELECT * FROM pedido_items WHERE pedido_id=$1`, [pedido.id]);
                const cfdi = await facturama.crearCFDI({
                    pedido: pedidoActualizado,
                    items: itemsQ.rows,
                    receptor: pedido.cfdi_receptor,
                    mpPago,
                });
                await pool.query(`
                    UPDATE pedidos SET cfdi_id=$1, cfdi_uuid=$2, actualizado_en=NOW()
                     WHERE id=$3
                `, [cfdi.id, cfdi.uuid, pedido.id]);

                // Descargamos ambos archivos para adjuntar al correo
                const pdf = await facturama.descargarCFDI(cfdi.id, 'pdf');
                const xml = await facturama.descargarCFDI(cfdi.id, 'xml');
                facturaAdjuntos = { pdf, xml };
            } catch (e) {
                console.warn('CFDI generación:', e.message);
                await pool.query(`UPDATE pedidos SET cfdi_error=$1 WHERE id=$2`, [e.message.slice(0, 500), pedido.id]);
            }
        }

        // Emails
        try {
            const cli = await pool.query(`SELECT email FROM clientes WHERE id=$1`, [pedido.cliente_id]);
            const email = cli.rows[0]?.email;
            const itemsAux = (await pool.query(`SELECT * FROM pedido_items WHERE pedido_id=$1`, [pedido.id])).rows;
            await emails.enviarConfirmacionPedido(pedidoActualizado, itemsAux, email);
            await emails.enviarNotificacionEquipo(pedidoActualizado);

            if (pedidoActualizado.guia) {
                await emails.enviarEnvioListo(pedidoActualizado, email);
            }
            if (facturaAdjuntos) {
                await emails.enviarFactura(pedidoActualizado, email,
                    facturaAdjuntos.pdf.buffer, facturaAdjuntos.xml.buffer,
                    facturaAdjuntos.pdf.filename, facturaAdjuntos.xml.filename);
            }
        } catch (e) { console.warn('emails post-pago:', e.message); }

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('marcarPagado:', err);
    } finally {
        client.release();
    }
}
