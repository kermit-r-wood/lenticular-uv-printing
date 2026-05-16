from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image
import pytest
from starlette.testclient import TestClient

from lenticular_raster.web import create_app


def png_bytes(color: tuple[int, int, int]) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (20, 10), color).save(buffer, format="PNG")
    return buffer.getvalue()


def assert_png_dpi(image: Image.Image, expected: int) -> None:
    dpi = image.info.get("dpi")
    assert dpi is not None
    assert dpi[0] == pytest.approx(expected, abs=0.5)
    assert dpi[1] == pytest.approx(expected, abs=0.5)


def test_home_page_shows_upload_form_and_e1_defaults(tmp_path: Path) -> None:
    client = TestClient(create_app(output_root=tmp_path))

    response = client.get("/")

    assert response.status_code == 200
    assert "光栅画生成器" in response.text
    assert 'name="images"' in response.text
    assert 'name="lpi"' in response.text
    assert 'value="1440"' in response.text
    assert "eufyMake E1" in response.text


def test_generate_creates_preview_job_with_interlaced_and_depth_outputs(tmp_path: Path) -> None:
    client = TestClient(create_app(output_root=tmp_path))

    response = client.post(
        "/generate",
        data={
            "width_mm": "10",
            "height_mm": "5",
            "ppi": "254",
            "lpi": "10",
            "orientation": "vertical",
            "phase": "0",
            "profile": "sine",
            "max_depth_value": "65535",
        },
        files=[
            ("images", ("red.png", png_bytes((255, 0, 0)), "image/png")),
            ("images", ("blue.png", png_bytes((0, 0, 255)), "image/png")),
        ],
        follow_redirects=False,
    )

    assert response.status_code == 303
    preview_url = response.headers["location"]
    assert preview_url.startswith("/preview/")

    preview = client.get(preview_url)
    assert preview.status_code == 200
    assert "预览与下载" in preview.text
    assert "interlaced.png" in preview.text
    assert "depth.png" in preview.text

    job_id = preview_url.rsplit("/", 1)[-1]
    interlaced = Image.open(tmp_path / job_id / "interlaced.png")
    depth = Image.open(tmp_path / job_id / "depth.png")
    assert interlaced.size == (100, 50)
    assert depth.mode == "I;16"
    assert depth.size == (100, 50)
    assert_png_dpi(interlaced, 254)
    assert_png_dpi(depth, 254)


def test_download_endpoint_serves_generated_png_files(tmp_path: Path) -> None:
    client = TestClient(create_app(output_root=tmp_path))
    response = client.post(
        "/generate",
        data={
            "width_mm": "10",
            "height_mm": "5",
            "ppi": "254",
            "lpi": "10",
            "orientation": "vertical",
            "phase": "0",
            "profile": "sine",
            "max_depth_value": "65535",
        },
        files=[
            ("images", ("red.png", png_bytes((255, 0, 0)), "image/png")),
            ("images", ("blue.png", png_bytes((0, 0, 255)), "image/png")),
        ],
        follow_redirects=False,
    )
    job_id = response.headers["location"].rsplit("/", 1)[-1]

    download = client.get(f"/download/{job_id}/depth.png")

    assert download.status_code == 200
    assert download.headers["content-type"] == "image/png"
    assert Image.open(BytesIO(download.content)).mode == "I;16"



def test_home_page_shows_calibrate_section(tmp_path: Path) -> None:
    client = TestClient(create_app(output_root=tmp_path))

    response = client.get("/")

    assert response.status_code == 200
    assert "相位校准" in response.text
    assert 'name="phases"' in response.text
    assert 'name="lpis"' in response.text
    assert 'name="block_mm"' in response.text


def test_calibrate_creates_phase_strip_job(tmp_path: Path) -> None:
    client = TestClient(create_app(output_root=tmp_path))

    response = client.post(
        "/calibrate",
        data={
            "block_mm": "10",   # 10mm @ 254ppi = 100px
            "ppi": "254",
            "orientation": "vertical",
            "phases": "-0.25,0,0.25",
            "lpis": "10,20",
            "profile": "sine",
            "max_depth_value": "65535",
        },
        files=[
            ("images", ("red.png", png_bytes((255, 0, 0)), "image/png")),
            ("images", ("blue.png", png_bytes((0, 0, 255)), "image/png")),
        ],
        follow_redirects=False,
    )

    assert response.status_code == 303
    job_id = response.headers["location"].rsplit("/", 1)[-1]

    preview = client.get(f"/preview/{job_id}")
    assert preview.status_code == 200

    interlaced = Image.open(tmp_path / job_id / "interlaced.png")
    depth = Image.open(tmp_path / job_id / "depth.png")
    assert interlaced.size == (100 * 3, 100 * 2)  # 3 phases cols, 2 lpis rows
    assert depth.mode == "I;16"
    assert depth.size == (100 * 3, 100 * 2)
