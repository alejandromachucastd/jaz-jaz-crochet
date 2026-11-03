# Jaz Jaz Crochet

Sitio estático en español para presentar creaciones de crochet y recibir consultas. No requiere framework, instalación de paquetes ni backend.

## Desarrollo local

Desde este directorio, inicia un servidor estático:

```sh
python3 -m http.server 4174
```

Abre `http://localhost:4174/`.

## Actualizar el catálogo

- Edita las tarjetas dentro de la sección `#catalogo` en `index.html`.
- Cambia títulos y descripciones por información confirmada. Los textos actuales describen visualmente las fotos, no son nombres comerciales confirmados.
- Al añadir o cambiar una pieza, actualiza también su enlace de galería, texto alternativo y caption para mantenerlos coherentes.
- Coloca los originales en `assets/images/` y ejecuta `python3 tools/optimize_images.py` para generar variantes responsive en `assets/images/optimized/`. El script requiere Pillow; conserva los originales.
- Añade un precio solo cuando el negocio lo confirme.

## Contacto

Los datos editables están en `assets/js/config.js`. Facebook es el único canal proporcionado hasta ahora. Para activar WhatsApp, completa `whatsapp` con el número internacional, solo dígitos. Los canales vacíos permanecen ocultos. Instagram, teléfono y correo solo deben añadirse si se confirman.

El formulario no envía datos a un servidor: genera un resumen local que la persona puede copiar, descargar y compartir por Facebook. Sin un número verificado, no se crea un enlace de WhatsApp.

## Verificación

```sh
node --check assets/js/main.js
node tools/audit.mjs --url http://localhost:4174/ --out /tmp/jaz-jaz-audit
```

La auditoría usa Chrome o Chromium y axe-core. Para ejecutarla sin descargar axe-core, añade `--no-axe`.

## Referencia y datos pendientes

Facebook: https://www.facebook.com/jaz.jaz.crochet/

Facebook no mostró publicaciones sin iniciar sesión. No se han confirmado nombres comerciales, precios, historia, número de WhatsApp ni otras redes; no presentes esos datos como hechos.
