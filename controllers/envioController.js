// controllers/envioController.js
const { pool } = require('../config/database');
const { cotizar } = require('../services/skydropx');

// POST /api/envio/cotizar { cp, items: [{ producto_id, cantidad }] }
// Si no se pasa items, usa el carrito actual de la sesión.
exports.cotizar = async (req, res) => {
    try {
        const cp = String(req.body.cp || '').trim();
        if (!/^\d{5}$/.test(cp)) return res.status(400).json({ error: 'CP inválido.' });

        let items = Array.isArray(req.body.items) ? req.body.items : null;
        if (!items) {
            const c = await pool.query(`SELECT items FROM carritos WHERE sesion_id = $1`, [req.sesionId]);
            items = c.rows[0]?.items || [];
        }
        if (!items.length) return res.status(400).json({ error: 'Carrito vacío.' });

        const ids = items.map(i => i.producto_id);
        const dims = await pool.query(
            `SELECT id, peso_kg, largo_cm, ancho_cm, alto_cm FROM productos WHERE id = ANY($1::int[])`,
            [ids]
        );
        const byId = Object.fromEntries(dims.rows.map(r => [r.id, r]));

        const paquetes = items.map(it => {
            const p = byId[it.producto_id];
            return {
                peso_kg: (Number(p?.peso_kg) || 0.5) * it.cantidad,
                largo_cm: p?.largo_cm || 10,
                ancho_cm: p?.ancho_cm || 10,
                alto_cm: p?.alto_cm || 10,
            };
        });

        const result = await cotizar({ cpDestino: cp, paquetes });
        res.json({ ok: true, ...result });
    } catch (err) {
        console.error('envio.cotizar:', err);
        res.status(500).json({ error: err.message || 'Error cotizando envío.' });
    }
};
