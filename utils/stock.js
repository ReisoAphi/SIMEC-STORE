// utils/stock.js
// Helpers para leer stock efectivo y aplicar reservas de carrito de forma atómica.
const { pool } = require('../config/database');

// Devuelve el stock efectivo (disponible - reservado) sumado entre almacenes.
async function getStockEfectivo(productoId) {
    const q = await pool.query(`
        SELECT COALESCE(SUM(stock_disponible - stock_reservado), 0)::int AS stock
          FROM inventario
         WHERE producto_id = $1
    `, [productoId]);
    return q.rows[0]?.stock || 0;
}

// Devuelve stock por almacén (para elegir de dónde reservar/enviar).
async function getStockPorAlmacen(productoId) {
    const q = await pool.query(`
        SELECT i.almacen_id, a.nombre AS almacen_nombre,
               GREATEST(i.stock_disponible - i.stock_reservado, 0)::int AS disponible
          FROM inventario i
     LEFT JOIN almacenes a ON a.id = i.almacen_id
         WHERE i.producto_id = $1
      ORDER BY disponible DESC, i.almacen_id
    `, [productoId]);
    return q.rows;
}

// Reserva `cantidad` para una sesión sobre el producto. Elige el almacén con más
// disponibilidad. Devuelve { ok, almacen_id, reservado } o { ok: false, error }.
async function reservarStock(client, productoId, sesionId, cantidad, ventanaMin = 15) {
    const q = await client.query(`
        SELECT almacen_id, GREATEST(stock_disponible - stock_reservado, 0)::int AS libre
          FROM inventario
         WHERE producto_id = $1
      ORDER BY libre DESC
         LIMIT 1
    `, [productoId]);
    if (q.rows.length === 0 || q.rows[0].libre < cantidad) {
        return { ok: false, error: 'Sin stock suficiente.' };
    }
    const almacenId = q.rows[0].almacen_id;

    await client.query(`
        UPDATE inventario SET stock_reservado = stock_reservado + $1, actualizado_en = NOW()
         WHERE producto_id = $2 AND almacen_id = $3
    `, [cantidad, productoId, almacenId]);

    const expira = new Date(Date.now() + ventanaMin * 60 * 1000);
    await client.query(`
        INSERT INTO reservas_carrito (sesion_id, producto_id, almacen_id, cantidad, expira_en)
        VALUES ($1, $2, $3, $4, $5)
    `, [sesionId, productoId, almacenId, cantidad, expira]);

    return { ok: true, almacen_id: almacenId, cantidad, expira };
}

// Libera todas las reservas activas de una sesión para un producto (para actualizar
// cantidad o eliminar del carrito).
async function liberarReservasSesionProducto(client, sesionId, productoId) {
    const q = await client.query(`
        SELECT almacen_id, cantidad FROM reservas_carrito
         WHERE sesion_id = $1 AND producto_id = $2
    `, [sesionId, productoId]);
    for (const r of q.rows) {
        await client.query(`
            UPDATE inventario
               SET stock_reservado = GREATEST(stock_reservado - $1, 0),
                   actualizado_en = NOW()
             WHERE producto_id = $2 AND almacen_id = $3
        `, [r.cantidad, productoId, r.almacen_id]);
    }
    await client.query(`DELETE FROM reservas_carrito WHERE sesion_id = $1 AND producto_id = $2`, [sesionId, productoId]);
    return q.rows.length;
}

// Libera todas las reservas de una sesión (vaciar carrito).
async function liberarReservasSesion(client, sesionId) {
    const q = await client.query(`SELECT DISTINCT producto_id FROM reservas_carrito WHERE sesion_id = $1`, [sesionId]);
    for (const r of q.rows) {
        await liberarReservasSesionProducto(client, sesionId, r.producto_id);
    }
}

module.exports = {
    getStockEfectivo,
    getStockPorAlmacen,
    reservarStock,
    liberarReservasSesionProducto,
    liberarReservasSesion,
};
