// controllers/adminController.js
const { pool } = require('../config/database');
const { getAdminDashboardHTML } = require('../views/adminDashboard');

exports.renderDashboard = async (req, res) => {
    try {
        const [prod, prodAct, cat, ped, cot, stockBajo] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS n FROM productos`),
            pool.query(`SELECT COUNT(*)::int AS n FROM productos WHERE activo = TRUE`),
            pool.query(`SELECT COUNT(*)::int AS n FROM categorias WHERE activo = TRUE`),
            pool.query(`SELECT COUNT(*)::int AS n FROM pedidos WHERE estatus = 'pendiente_pago'`),
            pool.query(`SELECT COUNT(*)::int AS n FROM cotizaciones WHERE estatus = 'nueva'`),
            pool.query(`
                SELECT COUNT(*)::int AS n
                FROM (
                    SELECT p.id, COALESCE(SUM(i.stock_disponible),0) AS stock
                    FROM productos p
                    LEFT JOIN inventario i ON i.producto_id = p.id
                    WHERE p.activo = TRUE
                    GROUP BY p.id
                ) t
                WHERE t.stock <= 3
            `),
        ]);

        res.send(getAdminDashboardHTML(req.adminUser, {
            totalProductos: prod.rows[0].n,
            totalActivos: prodAct.rows[0].n,
            totalCategorias: cat.rows[0].n,
            pedidosPendientes: ped.rows[0].n,
            cotizacionesNuevas: cot.rows[0].n,
            stockBajo: stockBajo.rows[0].n,
        }));
    } catch (err) {
        console.error('renderDashboard:', err);
        res.status(500).send('Error interno');
    }
};
