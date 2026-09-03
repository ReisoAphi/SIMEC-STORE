// controllers/seoController.js
// sitemap.xml, robots.txt y feed.xml (Google Merchant Center).
// Todo se genera dinámicamente desde la BD, así el contenido está siempre al día.
const { pool } = require('../config/database');
const { BASE_URL, STORE_MOUNT } = require('../config/env');

const PAGES_ESTATICAS = ['', 'categoria/todas', 'contacto', 'aviso-privacidad', 'terminos', 'devoluciones'];

function esc(str) {
    return String(str || '').replace(/[<>&'"]/g, s => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[s]));
}

function iso(d) {
    return new Date(d).toISOString();
}

// GET /sitemap.xml
exports.sitemap = async (_req, res) => {
    try {
        const [prods, cats] = await Promise.all([
            pool.query(`SELECT slug, actualizado_en FROM productos WHERE activo = TRUE ORDER BY actualizado_en DESC LIMIT 5000`),
            pool.query(`SELECT slug, creado_en FROM categorias WHERE activo = TRUE`),
        ]);
        const now = new Date().toISOString();
        const urls = [];

        for (const path of PAGES_ESTATICAS) {
            urls.push({
                loc: `${BASE_URL}${STORE_MOUNT}${path ? '/' + path : ''}`,
                lastmod: now,
                changefreq: path === '' ? 'daily' : 'weekly',
                priority: path === '' ? '1.0' : '0.5',
            });
        }
        for (const c of cats.rows) {
            urls.push({
                loc: `${BASE_URL}${STORE_MOUNT}/categoria/${esc(c.slug)}`,
                lastmod: iso(c.creado_en),
                changefreq: 'weekly',
                priority: '0.7',
            });
        }
        for (const p of prods.rows) {
            urls.push({
                loc: `${BASE_URL}${STORE_MOUNT}/producto/${esc(p.slug)}`,
                lastmod: iso(p.actualizado_en),
                changefreq: 'weekly',
                priority: '0.8',
            });
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    } catch (err) {
        console.error('seo.sitemap:', err);
        res.status(500).send('Error');
    }
};

// GET /robots.txt
exports.robots = (_req, res) => {
    const body = `User-agent: *
Allow: ${STORE_MOUNT}/
Disallow: ${STORE_MOUNT}/admin
Disallow: ${STORE_MOUNT}/api/
Disallow: ${STORE_MOUNT}/carrito
Disallow: ${STORE_MOUNT}/checkout
Disallow: ${STORE_MOUNT}/pedido/

Sitemap: ${BASE_URL}${STORE_MOUNT}/sitemap.xml
`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
};

// GET /feed.xml — Google Merchant Center (RSS 2.0 con extensiones g:*)
// Se publica el catálogo de productos con stock > 0 (los que tienen precio y son cotizables).
exports.merchantFeed = async (_req, res) => {
    try {
        const q = await pool.query(`
            SELECT p.id, p.sku, p.slug, p.nombre, p.marca, p.moneda,
                   p.precio_lista, p.iva_incluido, p.descripcion_corta, p.descripcion_larga,
                   p.oem_compatibles, p.peso_kg,
                   c.nombre AS categoria_nombre,
                   pi.url AS imagen_url,
                   COALESCE((SELECT SUM(GREATEST(i.stock_disponible - i.stock_reservado, 0))
                              FROM inventario i WHERE i.producto_id = p.id), 0)::int AS stock
              FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN LATERAL (
                SELECT url FROM producto_imagenes
                 WHERE producto_id = p.id
              ORDER BY es_principal DESC, orden ASC, id ASC LIMIT 1
              ) pi ON TRUE
             WHERE p.activo = TRUE AND p.precio_lista > 0
          ORDER BY p.id
             LIMIT 10000
        `);

        const items = q.rows.map(p => {
            const url = `${BASE_URL}${STORE_MOUNT}/producto/${esc(p.slug)}`;
            const img = p.imagen_url ? `${BASE_URL}${STORE_MOUNT}${p.imagen_url}` : '';
            const precio = p.iva_incluido ? Number(p.precio_lista) : Number(p.precio_lista) * 1.16;
            const availability = p.stock > 0 ? 'in stock' : 'preorder';
            const desc = (p.descripcion_larga || p.descripcion_corta || p.nombre || '').slice(0, 5000);
            return `  <item>
    <g:id>${esc(p.sku)}</g:id>
    <g:title>${esc(p.nombre)}</g:title>
    <g:description>${esc(desc)}</g:description>
    <g:link>${url}</g:link>
    ${img ? `<g:image_link>${esc(img)}</g:image_link>` : ''}
    <g:availability>${availability}</g:availability>
    <g:price>${precio.toFixed(2)} ${p.moneda || 'MXN'}</g:price>
    <g:condition>new</g:condition>
    <g:identifier_exists>true</g:identifier_exists>
    <g:mpn>${esc(p.sku)}</g:mpn>
    ${p.marca ? `<g:brand>${esc(p.marca)}</g:brand>` : '<g:brand>SIMEC</g:brand>'}
    ${p.categoria_nombre ? `<g:product_type>${esc(p.categoria_nombre)}</g:product_type>` : ''}
    ${p.peso_kg > 0 ? `<g:shipping_weight>${Number(p.peso_kg).toFixed(3)} kg</g:shipping_weight>` : ''}
  </item>`;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>SIMEC Store — Componentes industriales</title>
  <link>${BASE_URL}${STORE_MOUNT}</link>
  <description>Feed de productos para Google Merchant Center</description>
${items}
</channel>
</rss>`;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    } catch (err) {
        console.error('seo.merchantFeed:', err);
        res.status(500).send('Error');
    }
};
