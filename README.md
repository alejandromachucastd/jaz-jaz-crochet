# Jaz Jaz Crochet

Sitio estático en español para presentar creaciones de crochet y recibir consultas. No requiere framework, instalación de paquetes ni backend.

## Sitio publicado

- Vista pública (Vercel): https://jaz-jaz-crochet.vercel.app/
- Copia en GitHub Pages: https://alejandromachucastd.github.io/jaz-jaz-crochet/
- Repositorio: https://github.com/alejandromachucastd/jaz-jaz-crochet

Vercel publica desde este directorio con `vercel --prod` y el proyecto se llama `jaz-jaz-crochet`. La integración con Git no está conectada: la cuenta de Vercel no tiene permisos de administración sobre el repositorio, así que cada publicación se sube a mano. Para activarla, instala la GitHub App de Vercel en el repositorio y ejecuta `vercel git connect`.

`.vercelignore` deja fuera `tools/`, `README.md` y `CLAUDE.md`: al despliegue solo viaja el sitio.

`canonical`, `og:url`, `og:image`, `twitter:image` y el logo del JSON-LD son absolutos y apuntan a Vercel. Si el sitio pasa a un dominio propio, actualízalos. Las rutas internas son relativas, así que el sitio funciona igual en la raíz de Vercel y en el subdirectorio de GitHub Pages.

## Tipografía y estilos

- Los titulares usan **Newsreader** autoalojada en `assets/fonts/` (dos archivos woff2 variables, redonda y cursiva, pesos 300–600, precargados). Licencia SIL OFL 1.1 en `assets/fonts/OFL-Newsreader.txt`: si cambias la fuente, conserva su licencia.
- El texto corrido usa la pila del sistema para no cargar más bytes.
- La escala tipográfica vive en los tokens `--fs-*` con `clamp()`, sin tamaños sueltos por breakpoint.
- `.section__head--split` (Catálogo) y `.section__head--center` (Galería) varían el encabezado de sección; `.section--seam` dibuja la costura de hilo entre secciones y la banda oscura une Pedidos, Contacto y el pie.

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
