// controllers/usuariosController.js
const { pool } = require('../config/database');
const { getAdminUsuariosHTML } = require('../views/adminUsuarios');

const ROLES_VALIDOS = ['admin', 'almacenista', 'ventas'];

// GET /admin/usuarios
exports.list = async (req, res) => {
    try {
        const q = await pool.query(`
            SELECT id, email, nombre, rol, activo, creado_en
              FROM usuarios
             ORDER BY creado_en DESC, id DESC
        `);
        res.send(getAdminUsuariosHTML(req.adminUser, q.rows));
    } catch (err) {
        console.error('usuarios.list:', err);
        res.status(500).send('Error interno');
    }
};

// POST /api/admin/usuarios
exports.create = async (req, res) => {
    try {
        let { email, nombre, rol } = req.body;
        if (!email || !email.includes('@')) return res.status(400).json({ error: 'Correo inválido.' });
        email = String(email).toLowerCase().trim();
        rol = ROLES_VALIDOS.includes(rol) ? rol : 'admin';

        const dup = await pool.query(`SELECT id FROM usuarios WHERE LOWER(email) = $1`, [email]);
        if (dup.rows.length > 0) return res.status(400).json({ error: 'Ya existe un usuario con ese correo.' });

        const q = await pool.query(`
            INSERT INTO usuarios (email, nombre, rol, activo)
            VALUES ($1, $2, $3, TRUE)
            RETURNING id
        `, [email, (nombre || '').trim() || null, rol]);

        res.json({ ok: true, id: q.rows[0].id });
    } catch (err) {
        console.error('usuarios.create:', err);
        res.status(500).json({ error: 'Error creando el usuario.' });
    }
};

// PUT /api/admin/usuarios/:id
exports.update = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { nombre, rol, activo } = req.body;
        const rolLimpio = ROLES_VALIDOS.includes(rol) ? rol : 'admin';

        // Protección: no dejarse desactivar/degradar a uno mismo
        if (id === req.adminUser.id) {
            if (activo === false) return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
            if (rolLimpio !== 'admin') return res.status(400).json({ error: 'No puedes quitarte el rol de admin a ti mismo.' });
        }

        // Protección: siempre debe quedar al menos un admin activo
        const adminsActivos = await pool.query(
            `SELECT COUNT(*)::int AS n FROM usuarios WHERE rol='admin' AND activo=TRUE AND id <> $1`,
            [id]
        );
        if (adminsActivos.rows[0].n === 0 && (rolLimpio !== 'admin' || activo === false)) {
            return res.status(400).json({ error: 'Debe existir al menos un admin activo.' });
        }

        await pool.query(`
            UPDATE usuarios
               SET nombre = $1, rol = $2, activo = $3
             WHERE id = $4
        `, [(nombre || '').trim() || null, rolLimpio, activo !== false, id]);

        res.json({ ok: true });
    } catch (err) {
        console.error('usuarios.update:', err);
        res.status(500).json({ error: 'Error actualizando el usuario.' });
    }
};

// DELETE /api/admin/usuarios/:id
exports.remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (id === req.adminUser.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
        }
        const adminsActivos = await pool.query(
            `SELECT COUNT(*)::int AS n FROM usuarios WHERE rol='admin' AND activo=TRUE AND id <> $1`,
            [id]
        );
        if (adminsActivos.rows[0].n === 0) {
            return res.status(400).json({ error: 'Debe existir al menos un admin activo.' });
        }
        await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('usuarios.remove:', err);
        res.status(500).json({ error: 'Error eliminando el usuario.' });
    }
};
