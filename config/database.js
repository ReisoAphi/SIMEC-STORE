// config/database.js
const { Pool } = require('pg');
const { DB_CONFIG, SUPER_ADMIN_EMAIL } = require('./env');

const pool = new Pool(DB_CONFIG);

async function inicializarBaseDeDatos() {
    const client = await pool.connect();
    try {
        // -------- Usuarios (admin / staff de la tienda) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                nombre VARCHAR(120),
                rol VARCHAR(30) NOT NULL DEFAULT 'admin',
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                codigo VARCHAR(10),
                expiracion BIGINT,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // -------- Almacenes --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS almacenes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(120) NOT NULL,
                cp_origen VARCHAR(10) NOT NULL,
                direccion TEXT,
                activo BOOLEAN NOT NULL DEFAULT TRUE
            );
        `);

        // -------- Categorías (árbol) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS categorias (
                id SERIAL PRIMARY KEY,
                padre_id INT REFERENCES categorias(id) ON DELETE SET NULL,
                slug VARCHAR(140) UNIQUE NOT NULL,
                nombre VARCHAR(140) NOT NULL,
                descripcion TEXT,
                meta_title VARCHAR(200),
                meta_description VARCHAR(320),
                orden INT NOT NULL DEFAULT 0,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // -------- Productos --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(80) UNIQUE NOT NULL,
                slug VARCHAR(200) UNIQUE NOT NULL,
                nombre VARCHAR(200) NOT NULL,
                marca VARCHAR(120),
                categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL,
                descripcion_corta VARCHAR(500),
                descripcion_larga TEXT,
                especificaciones JSONB NOT NULL DEFAULT '{}'::jsonb,
                oem_compatibles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                precio_lista NUMERIC(12,2) NOT NULL DEFAULT 0,
                moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
                iva_incluido BOOLEAN NOT NULL DEFAULT FALSE,
                peso_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
                largo_cm NUMERIC(10,2) NOT NULL DEFAULT 0,
                ancho_cm NUMERIC(10,2) NOT NULL DEFAULT 0,
                alto_cm NUMERIC(10,2) NOT NULL DEFAULT 0,
                meta_title VARCHAR(200),
                meta_description VARCHAR(320),
                permite_cotizacion BOOLEAN NOT NULL DEFAULT TRUE,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_productos_sku_lower ON productos(LOWER(sku));`);

        // -------- Imágenes de producto --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS producto_imagenes (
                id SERIAL PRIMARY KEY,
                producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                url VARCHAR(500) NOT NULL,
                alt VARCHAR(200),
                orden INT NOT NULL DEFAULT 0,
                es_principal BOOLEAN NOT NULL DEFAULT FALSE,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_prod_img_producto ON producto_imagenes(producto_id);`);

        // -------- Inventario --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS inventario (
                producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                almacen_id INT NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
                stock_disponible INT NOT NULL DEFAULT 0,
                stock_reservado INT NOT NULL DEFAULT 0,
                ubicacion VARCHAR(80),
                actualizado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (producto_id, almacen_id)
            );
        `);

        // -------- Movimientos de inventario (auditoría) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS movimientos_inventario (
                id BIGSERIAL PRIMARY KEY,
                producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                almacen_id INT NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
                delta INT NOT NULL,
                motivo VARCHAR(40) NOT NULL,
                referencia VARCHAR(120),
                notas TEXT,
                usuario_email VARCHAR(255),
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos_inventario(producto_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_mov_creado ON movimientos_inventario(creado_en DESC);`);

        // -------- Reservas de carrito (libera stock si abandonan) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS reservas_carrito (
                id BIGSERIAL PRIMARY KEY,
                sesion_id VARCHAR(80) NOT NULL,
                producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                almacen_id INT NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
                cantidad INT NOT NULL,
                expira_en TIMESTAMP NOT NULL,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_res_sesion ON reservas_carrito(sesion_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_res_expira ON reservas_carrito(expira_en);`);

        // -------- Clientes (guest checkout) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS clientes (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                nombre VARCHAR(200),
                telefono VARCHAR(40),
                es_empresa BOOLEAN NOT NULL DEFAULT FALSE,
                razon_social VARCHAR(300),
                rfc VARCHAR(20),
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // -------- Direcciones --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS direcciones (
                id SERIAL PRIMARY KEY,
                cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                etiqueta VARCHAR(60),
                calle VARCHAR(200) NOT NULL,
                numero_ext VARCHAR(20),
                numero_int VARCHAR(20),
                colonia VARCHAR(120),
                municipio VARCHAR(120),
                estado VARCHAR(80),
                cp VARCHAR(10) NOT NULL,
                referencias TEXT,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // -------- Pedidos --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                folio VARCHAR(20) UNIQUE NOT NULL,
                cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
                direccion_envio_id INT REFERENCES direcciones(id) ON DELETE SET NULL,
                estatus VARCHAR(30) NOT NULL DEFAULT 'pendiente_pago',
                subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
                envio NUMERIC(12,2) NOT NULL DEFAULT 0,
                iva NUMERIC(12,2) NOT NULL DEFAULT 0,
                total NUMERIC(12,2) NOT NULL DEFAULT 0,
                moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
                transportista VARCHAR(60),
                servicio_envio VARCHAR(120),
                guia VARCHAR(120),
                tracking_url VARCHAR(400),
                mp_payment_id VARCHAR(80),
                mp_preference_id VARCHAR(120),
                requiere_factura BOOLEAN NOT NULL DEFAULT FALSE,
                cfdi_uso VARCHAR(10),
                cfdi_id VARCHAR(80),
                cfdi_url_pdf VARCHAR(400),
                cfdi_url_xml VARCHAR(400),
                notas TEXT,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_estatus ON pedidos(estatus);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_creado ON pedidos(creado_en DESC);`);

        // Auto-migración: datos fiscales del receptor y estado de la factura
        try { await client.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cfdi_receptor JSONB;`); } catch (_) {}
        try { await client.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cfdi_uuid VARCHAR(40);`); } catch (_) {}
        try { await client.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cfdi_error TEXT;`); } catch (_) {}
        try { await client.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mp_payment_method VARCHAR(40);`); } catch (_) {}

        // Auto-migración: cuentas de cliente (login por código email, opt-in en checkout)
        try { await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo VARCHAR(10);`); } catch (_) {}
        try { await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS expiracion BIGINT;`); } catch (_) {}
        try { await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cuenta_activa BOOLEAN NOT NULL DEFAULT FALSE;`); } catch (_) {}

        // -------- Items del pedido --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS pedido_items (
                id SERIAL PRIMARY KEY,
                pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
                producto_id INT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
                sku_snapshot VARCHAR(80) NOT NULL,
                nombre_snapshot VARCHAR(200) NOT NULL,
                cantidad INT NOT NULL,
                precio_unit NUMERIC(12,2) NOT NULL,
                precio_total NUMERIC(12,2) NOT NULL
            );
        `);

        // -------- Cotizaciones (para productos sin stock) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id SERIAL PRIMARY KEY,
                folio VARCHAR(20) UNIQUE NOT NULL,
                producto_id INT REFERENCES productos(id) ON DELETE SET NULL,
                sku_snapshot VARCHAR(80),
                nombre_snapshot VARCHAR(200),
                cantidad INT NOT NULL DEFAULT 1,
                cliente_email VARCHAR(255) NOT NULL,
                cliente_nombre VARCHAR(200),
                cliente_telefono VARCHAR(40),
                cliente_empresa VARCHAR(200),
                cp_destino VARCHAR(10),
                mensaje TEXT,
                estatus VARCHAR(30) NOT NULL DEFAULT 'nueva',
                respondido_por VARCHAR(255),
                respuesta TEXT,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_cot_estatus ON cotizaciones(estatus);`);

        // -------- Sesiones de carrito (persistencia server-side) --------
        await client.query(`
            CREATE TABLE IF NOT EXISTS carritos (
                sesion_id VARCHAR(80) PRIMARY KEY,
                cliente_email VARCHAR(255),
                items JSONB NOT NULL DEFAULT '[]'::jsonb,
                actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // -------- Semillas --------
        if (SUPER_ADMIN_EMAIL) {
            await client.query(
                `INSERT INTO usuarios (email, nombre, rol) VALUES ($1, 'Super Admin', 'admin')
                 ON CONFLICT (email) DO NOTHING`,
                [SUPER_ADMIN_EMAIL]
            );
        }

        await client.query(`
            INSERT INTO almacenes (id, nombre, cp_origen, direccion)
            VALUES (1, 'Almacén principal', '66600', 'Apodaca, Nuevo León')
            ON CONFLICT (id) DO NOTHING;
        `);
        // Aseguramos que la secuencia no se atore por el insert con id fijo
        await client.query(`SELECT setval(pg_get_serial_sequence('almacenes','id'), GREATEST((SELECT MAX(id) FROM almacenes), 1));`);

        console.log('✅ Base de datos SIMEC-STORE inicializada.');
    } catch (err) {
        console.error('❌ Error inicializando BD:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, inicializarBaseDeDatos };
