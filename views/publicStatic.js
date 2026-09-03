// views/publicStatic.js
// Páginas legales/institucionales. Contenido placeholder — para reemplazar
// con el texto oficial que revise el área legal.
const { pageLayout } = require('./layout');
const { STORE_MOUNT, BASE_URL } = require('../config/env');
const { cartCounterScript } = require('./publicComponents');

const paginas = {
    'aviso-privacidad': {
        title: 'Aviso de privacidad — SIMEC Store',
        h1: 'Aviso de privacidad',
        body: `
            <p>SIMEC Automation, S.A. de C.V. ("SIMEC"), con domicilio en Apodaca, Nuevo León, México, es responsable del tratamiento de los datos personales que nos proporcionas al comprar en esta tienda o al solicitar una cotización.</p>
            <p><strong>Datos que recabamos:</strong> nombre, correo, teléfono, dirección de envío, RFC y datos fiscales cuando solicitas factura.</p>
            <p><strong>Finalidades:</strong> procesar tu pedido, generar tu factura CFDI 4.0, coordinar el envío y darte soporte post-venta.</p>
            <p><strong>Terceros:</strong> compartimos datos únicamente con proveedores de envío (Skydropx, DHL, FedEx, Estafeta) y con nuestro PAC de facturación (Facturama), en la medida estrictamente necesaria para cumplir el servicio.</p>
            <p><strong>Derechos ARCO:</strong> puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento escribiendo a <a href="mailto:privacidad@simecautomation.com" style="color:var(--primary-red)">privacidad@simecautomation.com</a>.</p>
            <p class="text-soft">Este texto es un placeholder — reemplázalo con el aviso oficial que revise el área legal.</p>
        `,
    },
    'terminos': {
        title: 'Términos y condiciones — SIMEC Store',
        h1: 'Términos y condiciones',
        body: `
            <p>Al realizar una compra en SIMEC Store, aceptas los siguientes términos:</p>
            <ol>
                <li><strong>Disponibilidad:</strong> solo publicamos productos que tenemos físicamente en almacén. La cantidad mostrada se aparta 15 minutos al agregar al carrito.</li>
                <li><strong>Precios y moneda:</strong> los precios están expresados en pesos mexicanos (MXN) e incluyen o excluyen IVA según se indique.</li>
                <li><strong>Envíos:</strong> el costo se cotiza al momento de pagar. Los tiempos de entrega dependen de la paquetería seleccionada.</li>
                <li><strong>Facturación:</strong> el CFDI 4.0 se emite automáticamente al confirmar el pago, siempre que hayas proporcionado tus datos fiscales.</li>
                <li><strong>Devoluciones:</strong> consulta nuestra política de devoluciones.</li>
            </ol>
            <p class="text-soft">Este texto es un placeholder — reemplázalo con los términos oficiales que revise el área legal.</p>
        `,
    },
    'devoluciones': {
        title: 'Política de devoluciones — SIMEC Store',
        h1: 'Política de devoluciones',
        body: `
            <p>Aceptamos devoluciones dentro de los primeros 15 días naturales posteriores a la recepción del producto, sujeto a las siguientes condiciones:</p>
            <ul>
                <li>El producto debe encontrarse en su empaque original, sin uso y sin daños.</li>
                <li>Se debe presentar factura o número de pedido.</li>
                <li>Los gastos de envío de devolución corren por cuenta del cliente, salvo defectos de fabricación.</li>
                <li>El reembolso se procesa dentro de los 10 días hábiles siguientes a la recepción y verificación del producto.</li>
            </ul>
            <p>Para iniciar una devolución escribe a <a href="mailto:ventas@simecautomation.com" style="color:var(--primary-red)">ventas@simecautomation.com</a>.</p>
            <p class="text-soft">Este texto es un placeholder — reemplázalo con la política oficial.</p>
        `,
    },
    'contacto': {
        title: 'Contacto — SIMEC Store',
        h1: 'Contacto',
        body: `
            <p>¿Necesitas ayuda para elegir la pieza correcta o cotizar por volumen? Escríbenos:</p>
            <ul>
                <li><strong>Ventas:</strong> <a href="mailto:ventas@simecautomation.com" style="color:var(--primary-red)">ventas@simecautomation.com</a></li>
                <li><strong>Soporte técnico:</strong> <a href="mailto:soporte@simecautomation.com" style="color:var(--primary-red)">soporte@simecautomation.com</a></li>
                <li><strong>WhatsApp / teléfono:</strong> +52 (81) 0000-0000</li>
                <li><strong>Sitio corporativo:</strong> <a href="https://simecautomation.com" target="_blank" style="color:var(--primary-red)">simecautomation.com</a></li>
            </ul>
            <p class="text-soft">Ajusta estos datos con los oficiales del área de ventas.</p>
        `,
    },
};

function getPublicStaticHTML(slug) {
    const p = paginas[slug];
    if (!p) return '<h1>404</h1>';
    const body = `
        <div class="container-narrow" style="padding-top:32px;padding-bottom:60px">
            <h1 style="text-transform:uppercase;letter-spacing:1px;font-size:24px;margin:0 0 24px">${p.h1}</h1>
            <div style="color:var(--text-mid);line-height:1.7">${p.body}</div>
        </div>
        ${cartCounterScript()}
    `;
    return pageLayout({
        title: p.title,
        canonical: `${BASE_URL}${STORE_MOUNT}/${slug}`,
    }, body);
}

module.exports = { getPublicStaticHTML };
