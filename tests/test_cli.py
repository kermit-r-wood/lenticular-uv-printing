from pathlib import Path

import pytest
from PIL import Image

from lenticular_raster.cli import main


def assert_png_dpi(image: Image.Image, expected: int) -> None:
    dpi = image.info.get("dpi")
    assert dpi is not None
    assert dpi[0] == pytest.approx(expected, abs=0.5)
    assert dpi[1] == pytest.approx(expected, abs=0.5)


def test_cli_depth_command_writes_standalone_16_bit_depth_png(tmp_path: Path) -> None:
    output = tmp_path / "depth.png"

    exit_code = main(
        [
            "depth",
            "--out-depth",
            str(output),
            "--width-mm",
            "10",
            "--height-mm",
            "5",
            "--lpi",
            "60",
        ]
    )

    assert exit_code == 0
    depth = Image.open(output)
    assert depth.mode == "I;16"
    assert depth.size == (567, 283)
    assert_png_dpi(depth, 1440)


def test_cli_make_command_writes_interlaced_image_and_depth_map(tmp_path: Path) -> None:
    red = tmp_path / "red.png"
    blue = tmp_path / "blue.png"
    interlaced = tmp_path / "interlaced.png"
    depth = tmp_path / "depth.png"
    Image.new("RGB", (20, 10), (255, 0, 0)).save(red)
    Image.new("RGB", (20, 10), (0, 0, 255)).save(blue)

    exit_code = main(
        [
            "make",
            "--input",
            str(red),
            "--input",
            str(blue),
            "--out-interlaced",
            str(interlaced),
            "--out-depth",
            str(depth),
            "--ppi",
            "20",
            "--lpi",
            "5",
        ]
    )

    assert exit_code == 0
    interlaced_image = Image.open(interlaced)
    depth_image = Image.open(depth)
    assert interlaced_image.size == (20, 10)
    assert depth_image.mode == "I;16"
    assert_png_dpi(interlaced_image, 20)
    assert_png_dpi(depth_image, 20)


def test_cli_make_command_can_output_at_physical_print_size(tmp_path: Path) -> None:
    red = tmp_path / "red.png"
    blue = tmp_path / "blue.png"
    interlaced = tmp_path / "interlaced.png"
    Image.new("RGB", (20, 10), (255, 0, 0)).save(red)
    Image.new("RGB", (20, 10), (0, 0, 255)).save(blue)

    exit_code = main(
        [
            "make",
            "--input",
            str(red),
            "--input",
            str(blue),
            "--out-interlaced",
            str(interlaced),
            "--ppi",
            "254",
            "--lpi",
            "10",
            "--width-mm",
            "10",
            "--height-mm",
            "5",
        ]
    )

    assert exit_code == 0
    assert Image.open(interlaced).size == (100, 50)
