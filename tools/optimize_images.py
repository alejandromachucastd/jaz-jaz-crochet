#!/usr/bin/env python3
"""Genera las versiones optimizadas de las fotografías del sitio.

Reglas del proyecto:
- Los originales de ``assets/images/`` NO se modifican ni se mueven.
- Los derivados se escriben en ``assets/images/optimized/`` (WebP + JPEG de respaldo).
- Solo se procesan las fotografías aprobadas para uso público (ver README).

Uso:
    python3 tools/optimize_images.py

Requisitos: Python 3 y Pillow con soporte WebP
(``python3 -c "from PIL import features; print(features.check('webp'))"``).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "assets/images"
OUTPUT_DIR = SOURCE_DIR / "optimized"

# Anchos de las variantes responsive (en píxeles).
WIDTHS = (480, 960, 1440)
# Anchos del JPEG de respaldo para navegadores sin WebP.
FALLBACK_WIDTHS = (480, 960)

WEBP_QUALITY = 72
JPEG_QUALITY = 70

# nombre público -> archivo original
PHOTOS = {
    "dragon-lentes": "779896073_17988004746020545_5199406798303272106_n.jpg",
    "ciervo-peluche": "789213330_17989411431020545_4253794257958613463_n.jpg",
    "ciervo-detalle": "789264258_17989411419020545_1548393301703354794_n.jpg",
    "ciervo-perfil": "792518647_17989411389020545_6002290793459821721_n.jpg",
    "muneca-lavanda": "469387692_455474797593398_584636496937995744_n.jpg",
    "muneca-azul": "780709395_17988004761020545_2624077849147582106_n.jpg",
}

LOGO_SOURCE = "358440990_125573380583543_813003755288327330_n.jpg"
LOGO_BASE = "logo-jc"
LOGO_CROP = 620  # recorte cuadrado centrado alrededor del monograma
LOGO_WIDTHS = (96, 192, 384)
LOGO_FALLBACK_WIDTHS = (192, 384)
FAVICON_SIZES = (32, 180)

OG_SOURCE = "dragon-lentes"
OG_SIZE = (1200, 630)


def load_rgb(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB")


def resize(image: Image.Image, width: int) -> Image.Image:
    """Redimensiona conservando proporción y sin ampliar la imagen original."""
    width = min(width, image.width)
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)


def square_crop(image: Image.Image, size: int) -> Image.Image:
    """Recorte cuadrado centrado (el logo ya viene centrado en su lienzo)."""
    side = min(size, image.width, image.height)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))


def write_webp(image: Image.Image, target: Path) -> None:
    image.save(target, "WEBP", quality=WEBP_QUALITY, method=6)


def write_jpeg(image: Image.Image, target: Path) -> None:
    image.save(target, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)


def build_photo(name: str, filename: str) -> list[str]:
    source = SOURCE_DIR / filename
    if not source.exists():
        raise FileNotFoundError(f"No se encontró el original: {source}")

    image = load_rgb(source)
    generated: list[str] = []

    for width in WIDTHS:
        variant = resize(image, width)
        target = OUTPUT_DIR / f"{name}-{width}.webp"
        write_webp(variant, target)
        generated.append(target.name)

    for width in FALLBACK_WIDTHS:
        variant = resize(image, width)
        target = OUTPUT_DIR / f"{name}-{width}.jpg"
        write_jpeg(variant, target)
        generated.append(target.name)

    return generated


def build_logo() -> list[str]:
    source = SOURCE_DIR / LOGO_SOURCE
    if not source.exists():
        raise FileNotFoundError(f"No se encontró el original: {source}")

    logo = square_crop(load_rgb(source), LOGO_CROP)
    generated: list[str] = []

    for width in LOGO_WIDTHS:
        variant = resize(logo, width)
        target = OUTPUT_DIR / f"{LOGO_BASE}-{width}.webp"
        write_webp(variant, target)
        generated.append(target.name)

    for width in LOGO_FALLBACK_WIDTHS:
        variant = resize(logo, width)
        target = OUTPUT_DIR / f"{LOGO_BASE}-{width}.jpg"
        write_jpeg(variant, target)
        generated.append(target.name)

    for size in FAVICON_SIZES:
        variant = resize(logo, size)
        target = OUTPUT_DIR / f"favicon-{size}.png"
        variant.save(target, "PNG", optimize=True)
        generated.append(target.name)

    return generated


def build_og_image() -> list[str]:
    filename = PHOTOS[OG_SOURCE]
    image = load_rgb(SOURCE_DIR / filename)
    target_width, target_height = OG_SIZE

    # Recorte central con la proporción social (1200x630) y luego reescalado.
    ratio = target_width / target_height
    crop_width = min(image.width, round(image.height * ratio))
    crop_height = round(crop_width / ratio)
    left = (image.width - crop_width) // 2
    top = (image.height - crop_height) // 2
    cropped = image.crop((left, top, left + crop_width, top + crop_height))

    target = OUTPUT_DIR / "og-jaz-jaz.jpg"
    write_jpeg(cropped.resize(OG_SIZE, Image.LANCZOS), target)
    return [target.name]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated: list[str] = []

    for name, filename in PHOTOS.items():
        generated.extend(build_photo(name, filename))

    generated.extend(build_logo())
    generated.extend(build_og_image())

    print(f"Optimizadas {len(generated)} imágenes en {OUTPUT_DIR.relative_to(ROOT)}/")
    for name in sorted(generated):
        size_kb = (OUTPUT_DIR / name).stat().st_size / 1024
        print(f"  {name:<32} {size_kb:6.1f} KB")


if __name__ == "__main__":
    main()
