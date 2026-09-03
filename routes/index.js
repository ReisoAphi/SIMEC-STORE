// routes/index.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const categoriasController = require('../controllers/categoriasController');
const productosController = require('../controllers/productosController');
const inventarioController = require('../controllers/inventarioController');
const usuariosController = require('../controllers/usuariosController');
const publicoController = require('../controllers/publicoController');
const carritoController = require('../controllers/carritoController');
const cotizacionesController = require('../controllers/cotizacionesController');
const envioController = require('../controllers/envioController');
const checkoutController = require('../controllers/checkoutController');
const pagosController = require('../controllers/pagosController');
const pedidosAdminController = require('../controllers/pedidosAdminController');
const cotizacionesAdminController = require('../controllers/cotizacionesAdminController');
const seoController = require('../controllers/seoController');
const clientesController = require('../controllers/clientesController');
const { requireAdmin, requireAdminApi } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');

// ==============================================================
// SEO técnico
// ==============================================================
router.get('/sitemap.xml', seoController.sitemap);
router.get('/robots.txt', seoController.robots);
router.get('/feed.xml', seoController.merchantFeed);

// ==============================================================
// PÚBLICO
// ==============================================================
router.get('/', publicoController.home);
router.get('/categoria/todas', publicoController.categoriasIndex);
router.get('/categoria/:slug', publicoController.categoria);
router.get('/producto/:slug', publicoController.producto);
router.get('/buscar', publicoController.buscar);

// Carrito
router.get('/carrito', carritoController.page);
router.get('/api/carrito', carritoController.get);
router.post('/api/carrito/agregar', carritoController.agregar);
router.put('/api/carrito/actualizar', carritoController.actualizar);
router.delete('/api/carrito/:productoId', carritoController.eliminar);
router.delete('/api/carrito', carritoController.vaciar);

// Cotización pública
router.post('/api/cotizacion', cotizacionesController.crear);

// ==============================================================
// CUENTAS DE CLIENTE (login por código email)
// ==============================================================
router.get('/mi-cuenta', clientesController.miCuentaPage);
router.get('/api/cliente/me', clientesController.me);
router.post('/api/cliente/existe', clientesController.existe);
router.post('/api/cliente/request-code', clientesController.requestCode);
router.post('/api/cliente/login', clientesController.login);
router.post('/api/cliente/logout', clientesController.logout);

// Checkout + envío + pago
router.get('/checkout', checkoutController.page);
router.post('/api/envio/cotizar', envioController.cotizar);
router.post('/api/checkout/confirmar', checkoutController.confirmar);
router.get('/pedido/:folio', pagosController.pedido);
router.post('/api/mp/webhook', pagosController.webhook);
router.get('/api/mp/webhook', pagosController.webhook);

// Páginas estáticas
router.get('/aviso-privacidad', publicoController.staticPage('aviso-privacidad'));
router.get('/terminos', publicoController.staticPage('terminos'));
router.get('/devoluciones', publicoController.staticPage('devoluciones'));
router.get('/contacto', publicoController.staticPage('contacto'));

// ==============================================================
// AUTH ADMIN
// ==============================================================
router.get('/admin/login', authController.renderLogin);
router.post('/admin/request-code', authController.requestCode);
router.post('/admin/login', authController.login);
router.get('/admin/logout', authController.logout);

// ==============================================================
// DASHBOARD
// ==============================================================
router.get('/admin', requireAdmin, adminController.renderDashboard);

// ==============================================================
// CATEGORÍAS
// ==============================================================
router.get('/admin/categorias', requireAdmin, categoriasController.list);
router.get('/admin/categorias/nueva', requireAdmin, categoriasController.formNew);
router.get('/admin/categorias/:id/editar', requireAdmin, categoriasController.formEdit);
router.post('/api/admin/categorias', requireAdminApi, categoriasController.create);
router.put('/api/admin/categorias/:id', requireAdminApi, categoriasController.update);
router.delete('/api/admin/categorias/:id', requireAdminApi, categoriasController.remove);

// ==============================================================
// PRODUCTOS
// ==============================================================
router.get('/admin/productos', requireAdmin, productosController.list);
router.get('/admin/productos/nuevo', requireAdmin, productosController.formNew);
router.get('/admin/productos/:id/editar', requireAdmin, productosController.formEdit);
router.post('/api/admin/productos', requireAdminApi, productosController.create);
router.put('/api/admin/productos/:id', requireAdminApi, productosController.update);
router.delete('/api/admin/productos/:id', requireAdminApi, productosController.remove);

// Imágenes
router.post('/api/admin/productos/:id/imagenes',
    requireAdminApi,
    (req, res, next) => uploadImages(req, res, (err) => err ? res.status(400).json({ error: err.message }) : next()),
    productosController.uploadImages
);
router.delete('/api/admin/productos/:id/imagenes/:imgId', requireAdminApi, productosController.deleteImage);
router.post('/api/admin/productos/:id/imagenes/:imgId/principal', requireAdminApi, productosController.setPrincipal);
router.post('/api/admin/productos/:id/imagenes/reorder', requireAdminApi, productosController.reorderImages);

// ==============================================================
// INVENTARIO
// ==============================================================
router.get('/admin/inventario', requireAdmin, inventarioController.list);
router.get('/admin/inventario/:productoId/historial', requireAdmin, inventarioController.historial);
router.post('/api/admin/inventario/ajustar', requireAdminApi, inventarioController.ajustar);

// ==============================================================
// USUARIOS
// ==============================================================
router.get('/admin/usuarios', requireAdmin, usuariosController.list);
router.post('/api/admin/usuarios', requireAdminApi, usuariosController.create);
router.put('/api/admin/usuarios/:id', requireAdminApi, usuariosController.update);
router.delete('/api/admin/usuarios/:id', requireAdminApi, usuariosController.remove);

// ==============================================================
// ADMIN PEDIDOS
// ==============================================================
router.get('/admin/pedidos', requireAdmin, pedidosAdminController.list);
router.get('/admin/pedidos/:id', requireAdmin, pedidosAdminController.detalle);
router.get('/admin/pedidos/:id/factura/:tipo', requireAdmin, pedidosAdminController.descargarFactura);
router.put('/api/admin/pedidos/:id/estatus', requireAdminApi, pedidosAdminController.cambiarEstatus);
router.put('/api/admin/pedidos/:id/guia', requireAdminApi, pedidosAdminController.actualizarGuia);
router.post('/api/admin/pedidos/:id/facturar', requireAdminApi, pedidosAdminController.regenerarFactura);
router.post('/api/admin/pedidos/:id/reenviar-correo', requireAdminApi, pedidosAdminController.reenviarCorreo);

// ==============================================================
// ADMIN COTIZACIONES
// ==============================================================
router.get('/admin/cotizaciones', requireAdmin, cotizacionesAdminController.list);
router.put('/api/admin/cotizaciones/:id', requireAdminApi, cotizacionesAdminController.actualizar);
router.post('/api/admin/cotizaciones/:id/responder', requireAdminApi, cotizacionesAdminController.responder);

module.exports = router;
