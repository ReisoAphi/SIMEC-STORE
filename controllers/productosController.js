// controllers/productosController.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { uniqueSlug } = require('../utils/slug');
const { procesarImagenProducto } = require('../middleware/upload');
const { getAdminProductosHTML } = require('../views/adminProductos');
const { getAdminProductoFormHTML } = require('../views/adminProductoForm');

// ---------- Helpers ----------
function toNum(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

function toBool(v, def = false) {
    if (v === undefined || v === null || v === '') return def;
    return v === true || v === 'true' || v === 'on' || v === '1' || v === 1;
}

// Convierte oem_compatibles del payload (array o string separada) a TEXT[]
function parseOEM(input) {
    if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
    if (!input) return [];
    return String(input)
        .split(/[\n,;]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

// Convierte especificaciones del payload (array de {clave,valor}) a JSON objeto
function parseEspecs(input) {
    if (!input) return {};
    if (typeof input === 'object' && !Array.isArray(input)) return input;
    const out = {};
    if (Array.isArray(input)) {
        input.forEach(row => {
            const k = String(row?.clave || '').trim();
            const v = String(row?.valor || '').trim();
            if (k) out[k] = v;
        });
    }
    return out;
}

// ---------- Listado ----------
exports.list = async (req, res) => {
    try {
        const { q = '', categoria = '', filtro = '' } = req.query;
        const params = [];
        const where = [];

        if (q.trim()) {
            params.push('%' + q.trim().toLowerCase() + '%');
            where.push(`(LOWER(p.sku) LIKE $${params.length} OR LOWER(p.nombre) LIKE $${params.length} OR LOWER(p.marca) LIKE $${params.length})`);
        }
        if (categoria) {
            params.push(parseInt(categoria, 10));
            where.push(`p.categoria_id = $${params.length}`);
        }
        if (filtro === 'activos') where.push(`p.activo = TRUE`);
        if (filtro === 'inactivos') where.push(`p.activo = FALSE`);

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [prods, cats] = await Promise.all([
            pool.query(`
                SELECT p.id, p.sku, p.slug, p.nombre, p.marca, p.precio_lista, p.moneda,
                       p.activo, p.creado_en,
                       c.nombre AS categoria_nombre,
                       COALESCE(pi.url, NULL) AS imagen_principal,
                       COALESCE((SELECT SUM(i.stock_disponible) FROM inventario i WHERE i.producto_id = p.id), 0)::int AS stock
                  FROM productos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             LEFT JOIN LATERAL (
                    SELECT url FROM producto_imagenes
                     WHERE producto_id = p.id
                  ORDER BY es_principal DESC, orden ASC, id ASC
                     LIMIT 1
                  ) pi ON TRUE
                  ${whereSql}
              ORDER BY p.creado_en DESC, p.id DESC
                 LIMIT 500
            `, params),
            pool.query(`SELECT id, nombre FROM categorias WHERE activo = TRUE ORDER BY nombre`),
        ]);
        res.send(getAdminProductosHTML(req.adminUser, prods.rows, cats.rows, { q, categoria, filtro }));
    } catch (err) {
        console.error('productos.list:', err);
        res.status(500).send('Error interno');
    }
};

// ---------- Formularios ----------
async function cargarCategorias() {
    const q = await pool.query(`SELECT id, nombre FROM categorias ORDER BY nombre`);
    return q.rows;
}

async function cargarAlmacenes() {
    const q = await pool.query(`SELECT id, nombre FROM almacenes WHERE activo = TRUE ORDER BY id`);
    return q.rows;
}

exports.formNew = async (req, res) => {
    const [categorias, almacenes] = await Promise.all([cargarCategorias(), cargarAlmacenes()]);
    res.send(getAdminProductoFormHTML(req.adminUser, null, categorias, almacenes, []));
};

exports.formEdit = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const [prod, imgs, inv, categorias, almacenes] = await Promise.all([
        pool.query(`SELECT * FROM productos WHERE id = $1`, [id]),
        pool.query(`SELECT id, url, alt, orden, es_principal FROM producto_imagenes WHERE producto_id = $1 ORDER BY es_principal DESC, orden ASC, id ASC`, [id]),
        pool.query(`SELECT almacen_id, stock_disponible, stock_reservado FROM inventario WHERE producto_id = $1`, [id]),
        cargarCategorias(),
        cargarAlmacenes(),
    ]);
    if (prod.rows.length === 0) return res.status(404).send('Producto no encontrado');
    const p = prod.rows[0];
    p.imagenes = imgs.rows;
    p.inventarioMap = Object.fromEntries(inv.rows.map(r => [r.almacen_id, r]));
    res.send(getAdminProductoFormHTML(req.adminUser, p, categorias, almacenes, imgs.rows));
};

// ---------- Create / Update ----------
exports.create = async (req, res) => {
    try {
        const {
            sku, nombre, marca, categoria_id, descripcion_corta, descripcion_larga,
            especificaciones, oem_compatibles, precio_lista, moneda, iva_incluido,
            peso_kg, largo_cm, ancho_cm, alto_cm,
            meta_title, meta_description, permite_cotizacion, activo,
        } = req.body;

        if (!sku || !sku.trim()) return res.status(400).json({ error: 'El SKU es obligatorio.' });
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

        const skuClean = sku.trim();
        const dup = await pool.query(`SELECT id FROM productos WHERE LOWER(sku) = LOWER($1)`, [skuClean]);
        if (dup.rows.length > 0) return res.status(400).json({ error: 'Ya existe un producto con ese SKU.' });

        const slug = await uniqueSlug(pool, 'productos', `${nombre}-${skuClean}`);
        const q = await pool.query(`
            INSERT INTO productos (
                sku, slug, nombre, marca, categoria_id,
                descripcion_corta, descripcion_larga, especificaciones, oem_compatibles,
                precio_lista, moneda, iva_incluido, peso_kg, largo_cm, ancho_cm, alto_cm,
                meta_title, meta_description, permite_cotizacion, activo
            ) VALUES (
                $1,$2,$3,$4,$5, $6,$7,$8::jsonb,$9::text[],
                $10,$11,$12,$13,$14,$15,$16, $17,$18,$19,$20
            ) RETURNING id
        `, [
            skuClean, slug, nombre.trim(), (marca || '').trim() || null, categoria_id ? parseInt(categoria_id, 10) : null,
            (descripcion_corta || '').trim() || null, (descripcion_larga || '').trim() || null,
            JSON.stringify(parseEspecs(especificaciones)),
            parseOEM(oem_compatibles),
            toNum(precio_lista), (moneda || 'MXN').toUpperCase(), toBool(iva_incluido),
            toNum(peso_kg), toNum(largo_cm), toNum(ancho_cm), toNum(alto_cm),
            (meta_title || '').trim() || null, (meta_description || '').trim() || null,
            toBool(permite_cotizacion, true), toBool(activo, true),
        ]);

        res.json({ ok: true, id: q.rows[0].id, slug });
    } catch (err) {
        console.error('productos.create:', err);
        res.status(500).json({ error: 'Error creando el producto.' });
    }
};

exports.update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const {
            sku, nombre, marca, categoria_id, descripcion_corta, descripcion_larga,
            especificaciones, oem_compatibles, precio_lista, moneda, iva_incluido,
            peso_kg, largo_cm, ancho_cm, alto_cm,
            meta_title, meta_description, permite_cotizacion, activo, regenerar_slug,
        } = req.body;

        if (!sku || !sku.trim()) return res.status(400).json({ error: 'El SKU es obligatorio.' });
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

        const skuClean = sku.trim();
        const dup = await pool.query(`SELECT id FROM productos WHERE LOWER(sku) = LOWER($1) AND id <> $2`, [skuClean, id]);
        if (dup.rows.length > 0) return res.status(400).json({ error: 'Ya existe otro producto con ese SKU.' });

        let slugSet = '';
        const params = [
            skuClean, nombre.trim(), (marca || '').trim() || null, categoria_id ? parseInt(categoria_id, 10) : null,
            (descripcion_corta || '').trim() || null, (descripcion_larga || '').trim() || null,
            JSON.stringify(parseEspecs(especificaciones)),
            parseOEM(oem_compatibles),
            toNum(precio_lista), (moneda || 'MXN').toUpperCase(), toBool(iva_incluido),
            toNum(peso_kg), toNum(largo_cm), toNum(ancho_cm), toNum(alto_cm),
            (meta_title || '').trim() || null, (meta_description || '').trim() || null,
            toBool(permite_cotizacion, true), toBool(activo, true),
            id,
        ];
        if (regenerar_slug) {
            const newSlug = await uniqueSlug(pool, 'productos', `${nombre}-${skuClean}`, id);
            slugSet = ', slug = $21';
            params.push(newSlug);
        }

        await pool.query(`
            UPDATE productos SET
                sku = $1, nombre = $2, marca = $3, categoria_id = $4,
                descripcion_corta = $5, descripcion_larga = $6, especificaciones = $7::jsonb, oem_compatibles = $8::text[],
                precio_lista = $9, moneda = $10, iva_incluido = $11,
                peso_kg = $12, largo_cm = $13, ancho_cm = $14, alto_cm = $15,
                meta_title = $16, meta_description = $17,
                permite_cotizacion = $18, activo = $19,
                actualizado_en = NOW()
                ${slugSet}
             WHERE id = $20
        `, params);

        res.json({ ok: true });
    } catch (err) {
        console.error('productos.update:', err);
        res.status(500).json({ error: 'Error actualizando el producto.' });
    }
};

exports.remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const usados = await pool.query(`SELECT COUNT(*)::int AS n FROM pedido_items WHERE producto_id = $1`, [id]);
        if (usados.rows[0].n > 0) {
            // Soft-delete si tiene ventas asociadas
            await pool.query(`UPDATE productos SET activo = FALSE WHERE id = $1`, [id]);
            return res.json({ ok: true, softDelete: true });
        }
        // Borrar imágenes físicas
        const carpeta = path.join(__dirname, '..', 'public', 'uploads', 'products', String(id));
        if (fs.existsSync(carpeta)) fs.rmSync(carpeta, { recursive: true, force: true });
        await pool.query(`DELETE FROM productos WHERE id = $1`, [id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('productos.remove:', err);
        res.status(500).json({ error: 'Error eliminando el producto.' });
    }
};

// ---------- Imágenes ----------
exports.uploadImages = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const exists = await pool.query(`SELECT id FROM productos WHERE id = $1`, [id]);
        if (exists.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se recibieron archivos.' });

        const nombreProd = (await pool.query(`SELECT nombre FROM productos WHERE id = $1`, [id])).rows[0].nombre;
        const nuevosIds = [];

        // Determinar el próximo orden
        const ordenBase = await pool.query(`SELECT COALESCE(MAX(orden), -1) + 1 AS n FROM producto_imagenes WHERE producto_id = $1`, [id]);
        let orden = ordenBase.rows[0].n;
        const hayPrincipal = await pool.query(`SELECT 1 FROM producto_imagenes WHERE producto_id = $1 AND es_principal = TRUE LIMIT 1`, [id]);
        let asignarPrincipal = hayPrincipal.rows.length === 0;

        for (const file of req.files) {
            const url = await procesarImagenProducto(file.buffer, id, file.originalname);
            const q = await pool.query(`
                INSERT INTO producto_imagenes (producto_id, url, alt, orden, es_principal)
                VALUES ($1, $2, $3, $4, $5) RETURNING id
            `, [id, url, nombreProd, orden++, asignarPrincipal]);
            nuevosIds.push(q.rows[0].id);
            asignarPrincipal = false;
        }
        res.json({ ok: true, ids: nuevosIds });
    } catch (err) {
        console.error('productos.uploadImages:', err);
        res.status(500).json({ error: err.message || 'Error subiendo imágenes.' });
    }
};

exports.deleteImage = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const imgId = parseInt(req.params.imgId, 10);
        const q = await pool.query(`SELECT url, es_principal FROM producto_imagenes WHERE id = $1 AND producto_id = $2`, [imgId, id]);
        if (q.rows.length === 0) return res.status(404).json({ error: 'Imagen no encontrada.' });
        const img = q.rows[0];
        const rutaAbs = path.join(__dirname, '..', 'public', img.url);
        try { if (fs.existsSync(rutaAbs)) fs.unlinkSync(rutaAbs); } catch (_) { /* ignore */ }
        await pool.query(`DELETE FROM producto_imagenes WHERE id = $1`, [imgId]);

        // Si era principal, asignar principal a la siguiente
        if (img.es_principal) {
            await pool.query(`
                UPDATE producto_imagenes SET es_principal = TRUE
                 WHERE id = (SELECT id FROM producto_imagenes WHERE producto_id = $1 ORDER BY orden ASC, id ASC LIMIT 1)
            `, [id]);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('productos.deleteImage:', err);
        res.status(500).json({ error: 'Error eliminando imagen.' });
    }
};

exports.setPrincipal = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const imgId = parseInt(req.params.imgId, 10);
        await pool.query(`UPDATE producto_imagenes SET es_principal = FALSE WHERE producto_id = $1`, [id]);
        const q = await pool.query(`UPDATE producto_imagenes SET es_principal = TRUE WHERE id = $1 AND producto_id = $2`, [imgId, id]);
        if (q.rowCount === 0) return res.status(404).json({ error: 'Imagen no encontrada.' });
        res.json({ ok: true });
    } catch (err) {
        console.error('productos.setPrincipal:', err);
        res.status(500).json({ error: 'Error.' });
    }
};

exports.reorderImages = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { order } = req.body; // [imgId1, imgId2, ...]
        if (!Array.isArray(order)) return res.status(400).json({ error: 'Formato inválido.' });
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let i = 0; i < order.length; i++) {
                await client.query(`UPDATE producto_imagenes SET orden = $1 WHERE id = $2 AND producto_id = $3`, [i, parseInt(order[i], 10), id]);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('productos.reorderImages:', err);
        res.status(500).json({ error: 'Error reordenando imágenes.' });
    }
};
