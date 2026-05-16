from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from PIL import Image

from lenticular_raster.core import (
    EUFYMAKE_E1_PRESET,
    DEFAULT_PHASES,
    OutputSpec,
    build_phase_strip,
    generate_depth_map,
    interlace_images,
    lens_period_px,
    size_px_from_mm,
)
from lenticular_raster.image_io import save_png_with_dpi

PACKAGE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = PACKAGE_DIR / "templates"
STATIC_DIR = PACKAGE_DIR / "static"
DEFAULT_OUTPUT_ROOT = Path("outputs") / "jobs"


def create_app(output_root: str | Path = DEFAULT_OUTPUT_ROOT) -> FastAPI:
    root = Path(output_root)
    root.mkdir(parents=True, exist_ok=True)
    templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

    app = FastAPI(title="Lenticular Raster Web")
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.state.output_root = root
    app.state.templates = templates

    @app.get("/")
    async def index(request: Request):
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "preset": EUFYMAKE_E1_PRESET,
                "defaults": {
                    "width_mm": 50,
                    "height_mm": 50,
                    "ppi": EUFYMAKE_E1_PRESET.ppi,
                    "lpi": 60,
                    "phase": 0,
                    "max_depth_value": 65535,
                },
                "calibrate_defaults": {
                    "block_mm": 20,
                    "ppi": EUFYMAKE_E1_PRESET.ppi,
                    "lpi": 60,
                    "phases": ",".join(str(p) for p in DEFAULT_PHASES),
                    "max_depth_value": 65535,
                },
            },
        )

    @app.post("/generate")
    async def generate(
        images: Annotated[list[UploadFile], File()],
        width_mm: Annotated[float, Form()],
        height_mm: Annotated[float, Form()],
        ppi: Annotated[int, Form()],
        lpi: Annotated[float, Form()],
        orientation: Annotated[str, Form()],
        phase: Annotated[float, Form()],
        profile: Annotated[str, Form()],
        max_depth_value: Annotated[int, Form()],
    ):
        if len(images) < 2:
            raise HTTPException(status_code=400, detail="至少需要上传 2 张输入图片")

        width_px, height_px = size_px_from_mm(width_mm, height_mm, ppi)
        spec = OutputSpec(
            width_px=width_px,
            height_px=height_px,
            ppi=ppi,
            lpi=lpi,
            orientation=_orientation(orientation),
            phase_pitch=phase,
            depth_profile=_profile(profile),
        )
        try:
            spec.validate_against(EUFYMAKE_E1_PRESET)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        job_id = uuid.uuid4().hex
        job_dir = root / job_id
        upload_dir = job_dir / "uploads"
        upload_dir.mkdir(parents=True)

        loaded_images = []
        upload_names = []
        for index, upload in enumerate(images, start=1):
            suffix = Path(upload.filename or f"image-{index}.png").suffix or ".png"
            upload_path = upload_dir / f"image-{index}{suffix}"
            content = await upload.read()
            upload_path.write_bytes(content)
            loaded_images.append(Image.open(upload_path).convert("RGB"))
            upload_names.append(upload.filename or upload_path.name)

        interlaced = interlace_images(loaded_images, spec)
        depth = generate_depth_map(spec, max_value=max_depth_value)
        save_png_with_dpi(interlaced, job_dir / "interlaced.png", ppi=ppi)
        save_png_with_dpi(depth, job_dir / "depth.png", ppi=ppi)

        metadata = {
            "job_id": job_id,
            "uploads": upload_names,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "width_px": width_px,
            "height_px": height_px,
            "ppi": ppi,
            "lpi": lpi,
            "period_px": lens_period_px(ppi=ppi, lpi=lpi),
            "orientation": orientation,
            "phase": phase,
            "profile": profile,
            "max_depth_value": max_depth_value,
        }
        (job_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

        return RedirectResponse(url=f"/preview/{job_id}", status_code=303)

    @app.get("/preview/{job_id}")
    async def preview(request: Request, job_id: str):
        job_dir = _job_dir(root, job_id)
        metadata_path = job_dir / "metadata.json"
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail="预览任务不存在")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        return templates.TemplateResponse(
            request,
            "preview.html",
            {
                "job": metadata,
                "interlaced_url": f"/download/{job_id}/interlaced.png?inline=1",
                "depth_url": f"/download/{job_id}/depth.png?inline=1",
            },
        )

    @app.get("/download/{job_id}/{filename}")
    async def download(job_id: str, filename: str, inline: bool = False):
        if filename not in {"interlaced.png", "depth.png"}:
            raise HTTPException(status_code=404, detail="文件不存在")
        path = _job_dir(root, job_id) / filename
        if not path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        disposition = "inline" if inline else "attachment"
        return FileResponse(path, media_type="image/png", filename=filename, content_disposition_type=disposition)

    @app.post("/calibrate")
    async def calibrate(
        images: Annotated[list[UploadFile], File()],
        block_mm: Annotated[float, Form()],
        ppi: Annotated[int, Form()],
        lpi: Annotated[float, Form()],
        orientation: Annotated[str, Form()],
        phases: Annotated[str, Form()],
        profile: Annotated[str, Form()],
        max_depth_value: Annotated[int, Form()],
    ):
        if len(images) < 2:
            raise HTTPException(status_code=400, detail="至少需要上传 2 张输入图片")

        try:
            phase_list = [float(p.strip()) for p in phases.split(",") if p.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="相位格式错误，请用逗号分隔的数字")
        if not phase_list:
            raise HTTPException(status_code=400, detail="至少需要一个相位值")

        block_px, _ = size_px_from_mm(block_mm, block_mm, ppi)
        base_spec = OutputSpec(
            width_px=block_px,
            height_px=block_px,
            ppi=ppi,
            lpi=lpi,
            orientation=_orientation(orientation),
            phase_pitch=0.0,
            depth_profile=_profile(profile),
        )

        job_id = uuid.uuid4().hex
        job_dir = root / job_id
        upload_dir = job_dir / "uploads"
        upload_dir.mkdir(parents=True)

        loaded_images = []
        for index, upload in enumerate(images, start=1):
            suffix = Path(upload.filename or f"image-{index}.png").suffix or ".png"
            upload_path = upload_dir / f"image-{index}{suffix}"
            upload_path.write_bytes(await upload.read())
            loaded_images.append(Image.open(upload_path).convert("RGB"))

        interlaced_strip, depth_strip = build_phase_strip(
            loaded_images, base_spec=base_spec, phases=phase_list, max_depth_value=max_depth_value
        )
        save_png_with_dpi(interlaced_strip, job_dir / "interlaced.png", ppi=ppi)
        save_png_with_dpi(depth_strip, job_dir / "depth.png", ppi=ppi)

        metadata = {
            "job_id": job_id,
            "type": "calibrate",
            "block_mm": block_mm,
            "block_px": block_px,
            "phases": phase_list,
            "ppi": ppi,
            "lpi": lpi,
            "orientation": orientation,
            "profile": profile,
            "max_depth_value": max_depth_value,
        }
        (job_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

        return RedirectResponse(url=f"/preview/{job_id}", status_code=303)

    return app


def _job_dir(root: Path, job_id: str) -> Path:
    if not job_id.isalnum():
        raise HTTPException(status_code=404, detail="预览任务不存在")
    path = root / job_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="预览任务不存在")
    return path


def _orientation(value: str):
    if value not in {"vertical", "horizontal"}:
        raise HTTPException(status_code=400, detail="光栅方向必须是 vertical 或 horizontal")
    return value


def _profile(value: str):
    if value not in {"sine", "arc"}:
        raise HTTPException(status_code=400, detail="深度曲线必须是 sine 或 arc")
    return value


app = create_app()
