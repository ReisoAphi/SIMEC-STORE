// controllers/categoriasController.js
const { pool } = require('../config/database');
const { uniqueSlug } = require('../utils/slug');
const { getAdminCategoriasHTML, getAdminCategoriaFormHTML } = require('../views/adminCategorias');

// GET /admin/categorias — listado
exports.list = async (req, res) => {
    try {
        const q = await pool.query(`
            SELECT c.*,
                   (SELECT COUNT(*)::int FROM productos p WHERE p.categoria_id = c.id) AS n_productos,
                   pc.nombre AS padre_nombre
            FROM categorias c
            LEFT JOIN categorias pc ON pc.id = c.padre_id
            ORDER BY COALESCE(c.padre_id, 0), c.orden, c.nombre
        `);
        res.send(getAdminCategoriasHTML(req.adminUser, q.rows));
    } catch (err) {
        console.error('categorias.list:', err);
        res.status(500).send('Error interno');
    }
};

// GET /admin/categorias/nueva
exports.formNew = async (req, res) => {
    const padres = await pool.query(`SELECT id, nombre FROM categorias WHERE padre_id IS NULL ORDER BY nombre`);
    res.send(getAdminCategoriaFormHTML(req.adminUser, null, padres.rows));
};

// GET /admin/categorias/:id/editar
exports.formEdit = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const [cat, padres] = await Promise.all([
        pool.query(`SELECT * FROM categorias WHERE id = $1`, [id]),
        pool.query(`SELECT id, nombre FROM categorias WHERE padre_id IS NULL AND id <> $1 ORDER BY nombre`, [id]),
    ]);
    if (cat.rows.length === 0) return res.status(404).send('Categoría no encontrada');
    res.send(getAdminCategoriaFormHTML(req.adminUser, cat.rows[0], padres.rows));
};

// POST /api/admin/categorias
exports.create = async (req, res) => {
    try {
        const { nombre, padre_id, descripcion, meta_title, meta_description, orden, activo } = req.body;
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

        const slug = await uniqueSlug(pool, 'categorias', nombre);
        const q = await pool.query(`
            INSERT INTO categorias (nombre, slug, padre_id, descripcion, meta_title, meta_description, orden, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [
            nombre.trim(),
            slug,
            padre_id ? parseInt(padre_id, 10) : null,
            descripcion || null,
            meta_title || null,
            meta_description || null,
            parseInt(orden, 10) || 0,
            activo === false ? false : true,
        ]);

        res.json({ ok: true, id: q.rows[0].id, slug });
    } catch (err) {
        console.error('categorias.create:', err);
        res.status(500).json({ error: 'Error creando la categoría.' });
    }
};

// PUT /api/admin/categorias/:id
exports.update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { nombre, padre_id, descripcion, meta_title, meta_description, orden, activo, regenerar_slug } = req.body;
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

        // Evitar que una categoría se declare su propio padre o el de un descendiente directo
        if (padre_id && parseInt(padre_id, 10) === id) {
            return res.status(400).json({ error: 'Una categoría no puede ser su propio padre.' });
        }

        let slugSet = '';
        let params = [
            nombre.trim(),
            padre_id ? parseInt(padre_id, 10) : null,
            descripcion || null,
            meta_title || null,
            meta_description || null,
            parseInt(orden, 10) || 0,
            activo === false ? false : true,
            id,
        ];

        if (regenerar_slug) {
            const newSlug = await uniqueSlug(pool, 'categorias', nombre, id);
            slugSet = ', slug = $9';
            params.push(newSlug);
        }

        await pool.query(`
            UPDATE categorias
               SET nombre = $1, padre_id = $2, descripcion = $3,
                   meta_title = $4, meta_description = $5, orden = $6, activo = $7${slugSet}
             WHERE id = $8
        `, params);

        res.json({ ok: true });
    } catch (err) {
        console.error('categorias.update:', err);
        res.status(500).json({ error: 'Error actualizando la categoría.' });
    }
};

// DELETE /api/admin/categorias/:id
exports.remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const usados = await pool.query(`SELECT COUNT(*)::int AS n FROM productos WHERE categoria_id = $1`, [id]);
        if (usados.rows[0].n > 0) {
            return res.status(400).json({ error: `No se puede eliminar: hay ${usados.rows[0].n} producto(s) asignado(s).` });
        }
        const hijos = await pool.query(`SELECT COUNT(*)::int AS n FROM categorias WHERE padre_id = $1`, [id]);
        if (hijos.rows[0].n > 0) {
            return res.status(400).json({ error: 'Esta categoría tiene subcategorías. Elimínalas o muévelas primero.' });
        }
        await pool.query(`DELETE FROM categorias WHERE id = $1`, [id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('categorias.remove:', err);
        res.status(500).json({ error: 'Error eliminando la categoría.' });
    }
};
