// controllers/publicoController.js
const { pool } = require('../config/database');
const { getPublicHomeHTML } = require('../views/publicHome');
const { getPublicCategoriaHTML, getPublicCategoriasIndexHTML } = require('../views/publicCategoria');
const { getPublicProductoHTML } = require('../views/publicProducto');
const { getPublicBusquedaHTML } = require('../views/publicBusqueda');
const { getPublicStaticHTML } = require('../views/publicStatic');

const POR_PAGINA = 24;

// Consulta que decora productos con imagen principal + stock efectivo
function baseProductosSelect(extraWhere = '', params = [], orderBy = 'p.creado_en DESC', limit = 24, offset = 0) {
    return {
        text: `
            SELECT p.id, p.sku, p.slug, p.nombre, p.marca, p.precio_lista, p.moneda,
                   p.descripcion_corta, p.permite_cotizacion,
                   c.nombre AS categoria_nombre, c.slug AS categoria_slug,
                   pi.url AS imagen_url, pi.alt AS imagen_alt,
                   COALESCE((SELECT SUM(GREATEST(i.stock_disponible - i.stock_reservado, 0))
                               FROM inventario i WHERE i.producto_id = p.id), 0)::int AS stock
              FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN LATERAL (
                SELECT url, alt FROM producto_imagenes
                 WHERE producto_id = p.id
              ORDER BY es_principal DESC, orden ASC, id ASC LIMIT 1
              ) pi ON TRUE
             WHERE p.activo = TRUE ${extraWhere}
          ORDER BY ${orderBy}
             LIMIT ${limit} OFFSET ${offset}
        `,
        values: params,
    };
}

// GET /  (home)
exports.home = async (req, res) => {
    try {
        const [recientes, categorias] = await Promise.all([
            pool.query(baseProductosSelect('', [], 'p.creado_en DESC', 12, 0)),
            pool.query(`
                SELECT c.id, c.slug, c.nombre, c.descripcion,
                       (SELECT COUNT(*)::int FROM productos WHERE categoria_id = c.id AND activo = TRUE) AS n_productos
                  FROM categorias c
                 WHERE c.activo = TRUE AND c.padre_id IS NULL
              ORDER BY c.orden, c.nombre
                 LIMIT 8
            `),
        ]);
        res.send(getPublicHomeHTML({ recientes: recientes.rows, categorias: categorias.rows }));
    } catch (err) {
        console.error('publico.home:', err);
        res.status(500).send('Error interno');
    }
};

// GET /categoria/todas — índice de categorías
exports.categoriasIndex = async (_req, res) => {
    try {
        const q = await pool.query(`
            SELECT c.id, c.slug, c.nombre, c.descripcion,
                   (SELECT COUNT(*)::int FROM productos WHERE categoria_id = c.id AND activo = TRUE) AS n_productos
              FROM categorias c
             WHERE c.activo = TRUE
          ORDER BY COALESCE(c.padre_id, 0), c.orden, c.nombre
        `);
        res.send(getPublicCategoriasIndexHTML(q.rows));
    } catch (err) {
        console.error('publico.categoriasIndex:', err);
        res.status(500).send('Error interno');
    }
};

// GET /categoria/:slug
exports.categoria = async (req, res) => {
    try {
        const slug = req.params.slug;
        const pagina = Math.max(1, parseInt(req.query.p, 10) || 1);
        const orden = req.query.orden || 'reciente';

        const cat = await pool.query(`SELECT * FROM categorias WHERE slug = $1 AND activo = TRUE`, [slug]);
        if (cat.rows.length === 0) return res.status(404).send('Categoría no encontrada');
        const c = cat.rows[0];

        const orderBy = {
            reciente: 'p.creado_en DESC',
            precio_asc: 'p.precio_lista ASC',
            precio_desc: 'p.precio_lista DESC',
            nombre: 'p.nombre ASC',
        }[orden] || 'p.creado_en DESC';

        const [prods, count] = await Promise.all([
            pool.query(baseProductosSelect(
                'AND p.categoria_id = $1',
                [c.id],
                orderBy,
                POR_PAGINA,
                (pagina - 1) * POR_PAGINA
            )),
            pool.query(`SELECT COUNT(*)::int AS n FROM productos WHERE categoria_id = $1 AND activo = TRUE`, [c.id]),
        ]);

        res.send(getPublicCategoriaHTML({
            categoria: c,
            productos: prods.rows,
            total: count.rows[0].n,
            pagina,
            porPagina: POR_PAGINA,
            orden,
        }));
    } catch (err) {
        console.error('publico.categoria:', err);
        res.status(500).send('Error interno');
    }
};

// GET /producto/:slug
exports.producto = async (req, res) => {
    try {
        const slug = req.params.slug;
        const q = await pool.query(`
            SELECT p.*,
                   c.slug AS categoria_slug, c.nombre AS categoria_nombre,
                   pc.slug AS padre_slug, pc.nombre AS padre_nombre
              FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN categorias pc ON pc.id = c.padre_id
             WHERE p.slug = $1 AND p.activo = TRUE
        `, [slug]);
        if (q.rows.length === 0) return res.status(404).send('Producto no encontrado');
        const p = q.rows[0];

        const [imgs, stockRes] = await Promise.all([
            pool.query(`
                SELECT id, url, alt FROM producto_imagenes
                 WHERE producto_id = $1
              ORDER BY es_principal DESC, orden ASC, id ASC
            `, [p.id]),
            pool.query(`
                SELECT COALESCE(SUM(GREATEST(stock_disponible - stock_reservado, 0)), 0)::int AS stock
                  FROM inventario WHERE producto_id = $1
            `, [p.id]),
        ]);
        p.imagenes = imgs.rows;
        p.stock = stockRes.rows[0]?.stock || 0;

        // Productos relacionados (misma categoría)
        let relacionados = [];
        if (p.categoria_id) {
            const rel = await pool.query(baseProductosSelect(
                'AND p.categoria_id = $1 AND p.id <> $2',
                [p.categoria_id, p.id],
                'RANDOM()', 6, 0
            ));
            relacionados = rel.rows;
        }

        res.send(getPublicProductoHTML({ producto: p, relacionados }));
    } catch (err) {
        console.error('publico.producto:', err);
        res.status(500).send('Error interno');
    }
};

// GET /buscar?q=...
exports.buscar = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const pagina = Math.max(1, parseInt(req.query.p, 10) || 1);
        if (!q) return res.send(getPublicBusquedaHTML({ q, productos: [], total: 0, pagina, porPagina: POR_PAGINA }));

        const term = '%' + q.toLowerCase() + '%';
        // Búsqueda amplia: sku exacto (case-insensitive), nombre, marca, oem, descripcion
        const [prods, count] = await Promise.all([
            pool.query(baseProductosSelect(
                `AND (LOWER(p.sku) LIKE $1
                      OR LOWER(p.nombre) LIKE $1
                      OR LOWER(p.marca) LIKE $1
                      OR LOWER(p.descripcion_corta) LIKE $1
                      OR EXISTS (SELECT 1 FROM UNNEST(p.oem_compatibles) o WHERE LOWER(o) LIKE $1))`,
                [term],
                // Prioriza coincidencia exacta de SKU al inicio
                `CASE WHEN LOWER(p.sku) = LOWER('${q.replace(/'/g, "''")}') THEN 0 ELSE 1 END, p.nombre ASC`,
                POR_PAGINA,
                (pagina - 1) * POR_PAGINA
            )),
            pool.query(`
                SELECT COUNT(*)::int AS n FROM productos p WHERE p.activo = TRUE
                  AND (LOWER(p.sku) LIKE $1 OR LOWER(p.nombre) LIKE $1 OR LOWER(p.marca) LIKE $1
                       OR LOWER(p.descripcion_corta) LIKE $1
                       OR EXISTS (SELECT 1 FROM UNNEST(p.oem_compatibles) o WHERE LOWER(o) LIKE $1))
            `, [term]),
        ]);

        res.send(getPublicBusquedaHTML({ q, productos: prods.rows, total: count.rows[0].n, pagina, porPagina: POR_PAGINA }));
    } catch (err) {
        console.error('publico.buscar:', err);
        res.status(500).send('Error interno');
    }
};

// GET /aviso-privacidad, /terminos, /devoluciones, /contacto
exports.staticPage = (slug) => (_req, res) => {
    res.send(getPublicStaticHTML(slug));
};
