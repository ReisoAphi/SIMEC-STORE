// cron/liberarReservas.js
// Corre cada 60 segundos y libera reservas de carrito vencidas,
// devolviendo el stock a `stock_disponible` (via decremento del reservado).
const { pool } = require('../config/database');

const INTERVAL_MS = 60 * 1000;

async function tick(io) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const vencidas = await client.query(`
            SELECT id, producto_id, almacen_id, cantidad
              FROM reservas_carrito
             WHERE expira_en < NOW()
        `);
        for (const r of vencidas.rows) {
            await client.query(`
                UPDATE inventario
                   SET stock_reservado = GREATEST(stock_reservado - $1, 0),
                       actualizado_en = NOW()
                 WHERE producto_id = $2 AND almacen_id = $3
            `, [r.cantidad, r.producto_id, r.almacen_id]);
            await client.query(`DELETE FROM reservas_carrito WHERE id = $1`, [r.id]);
            // Notifica a la sala del producto para refrescar stock en vivo
            if (io) io.to(`producto:${r.producto_id}`).emit('stock:libera', {
                productoId: r.producto_id, cantidad: r.cantidad,
            });
        }
        await client.query('COMMIT');
        if (vencidas.rows.length > 0) {
            console.log(`⏱  Liberadas ${vencidas.rows.length} reserva(s) de carrito.`);
        }
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('liberarReservas.tick:', err.message);
    } finally {
        client.release();
    }
}

function iniciarLiberacionReservas(io) {
    setInterval(() => tick(io), INTERVAL_MS);
    // Un tick al arranque para limpiar rastros previos
    setTimeout(() => tick(io), 5000);
    console.log('⏱  Cron de liberación de reservas iniciado (cada 60s).');
}

module.exports = { iniciarLiberacionReservas };
