from __future__ import annotations

from pathlib import Path

from PIL import Image


def save_png_with_dpi(image: Image.Image, path: Path, *, ppi: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, dpi=(ppi, ppi))
