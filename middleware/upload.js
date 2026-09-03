// middleware/upload.js
// Middleware Multer + procesamiento Sharp para imágenes de productos.
// Guarda las originales en memoria, las convierte a WebP redimensionadas,
// y las escribe en public/uploads/products/<producto_id>/.
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB por imagen
const MAX_FILES = 12;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadImages = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Formato no permitido. Usa JPG, PNG o WEBP.'));
        }
        cb(null, true);
    },
}).array('imagenes', MAX_FILES);

/**
 * Procesa un buffer de imagen: convierte a WebP y aplica límite de tamaño.
 * Devuelve un objeto con la ruta relativa lista para guardar en BD.
 */
async function procesarImagenProducto(buffer, productoId, originalName) {
    const carpetaAbs = path.join(__dirname, '..', 'public', 'uploads', 'products', String(productoId));
    if (!fs.existsSync(carpetaAbs)) fs.mkdirSync(carpetaAbs, { recursive: true });

    const base = String(originalName || 'img')
        .toLowerCase()
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'img';

    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const fileName = `${base}-${stamp}.webp`;
    const rutaAbs = path.join(carpetaAbs, fileName);

    await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(rutaAbs);

    return `/uploads/products/${productoId}/${fileName}`;
}

module.exports = { uploadImages, procesarImagenProducto };
