// utils/slug.js
// Convierte "Baleros 6203 & Similares" -> "baleros-6203-similares"
function slugify(text, maxLen = 140) {
    return String(text || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quita acentos
        .toLowerCase()
        .replace(/&/g, ' y ')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, maxLen)
        .replace(/^-|-$/g, '');
}

// Asegura unicidad consultando la BD (append -2, -3, etc si choca)
async function uniqueSlug(pool, tabla, base, ignoreId = null) {
    const root = slugify(base) || 'item';
    let slug = root;
    let n = 2;
    while (true) {
        const params = ignoreId ? [slug, ignoreId] : [slug];
        const where = ignoreId ? 'slug = $1 AND id <> $2' : 'slug = $1';
        const q = await pool.query(`SELECT 1 FROM ${tabla} WHERE ${where} LIMIT 1`, params);
        if (q.rows.length === 0) return slug;
        slug = `${root}-${n++}`;
        if (n > 999) throw new Error('No se pudo generar slug único');
    }
}

module.exports = { slugify, uniqueSlug };
