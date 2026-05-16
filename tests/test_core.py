from pathlib import Path

import numpy as np
from PIL import Image

from lenticular_raster.core import (
    EUFYMAKE_E1_PRESET,
    OutputSpec,
    build_phase_strip,
    generate_depth_map,
    interlace_images,
    lens_period_px,
)


def solid(width: int, height: int, color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", (width, height), color)


def test_eufymake_e1_preset_uses_official_resolution_and_bed_size() -> None:
    assert EUFYMAKE_E1_PRESET.ppi == 1440
    assert EUFYMAKE_E1_PRESET.max_width_mm == 330
    assert EUFYMAKE_E1_PRESET.max_height_mm == 420
    assert EUFYMAKE_E1_PRESET.max_emboss_height_mm == 5


def test_lens_period_uses_ppi_divided_by_lpi() -> None:
    assert lens_period_px(ppi=1440, lpi=60) == 24
    assert lens_period_px(ppi=1200, lpi=75) == 16


def test_interlace_vertical_lenses_assigns_frames_by_column_within_period() -> None:
    red = solid(8, 2, (255, 0, 0))
    blue = solid(8, 2, (0, 0, 255))

    result = interlace_images(
        [red, blue],
        OutputSpec(width_px=8, height_px=2, ppi=8, lpi=2, orientation="vertical"),
    )

    pixels = np.asarray(result)
    assert pixels[:, 0:2].tolist() == np.asarray(red)[:, 0:2].tolist()
    assert pixels[:, 2:4].tolist() == np.asarray(blue)[:, 2:4].tolist()
    assert pixels[:, 4:6].tolist() == np.asarray(red)[:, 4:6].tolist()
    assert pixels[:, 6:8].tolist() == np.asarray(blue)[:, 6:8].tolist()


def test_interlace_phase_offset_moves_frame_assignment_by_fraction_of_pitch() -> None:
    red = solid(4, 1, (255, 0, 0))
    blue = solid(4, 1, (0, 0, 255))

    result = interlace_images(
        [red, blue],
        OutputSpec(
            width_px=4,
            height_px=1,
            ppi=4,
            lpi=1,
            phase_pitch=0.5,
            orientation="vertical",
        ),
    )

    pixels = np.asarray(result)
    assert pixels[0, 0:2].tolist() == [[0, 0, 255], [0, 0, 255]]
    assert pixels[0, 2:4].tolist() == [[255, 0, 0], [255, 0, 0]]


def test_depth_map_is_16_bit_repeating_low_high_low_lens_profile() -> None:
    depth = generate_depth_map(
        OutputSpec(width_px=8, height_px=2, ppi=8, lpi=2, orientation="vertical"),
        max_value=65535,
    )

    assert depth.mode == "I;16"
    values = np.asarray(depth)
    assert values.shape == (2, 8)
    assert values[:, 0].max() < 10000
    assert values[:, 2].min() > 55000
    assert values[:, 4].max() < 10000
    assert values[:, 6].min() > 55000


def test_outputs_are_rejected_when_they_exceed_e1_bed() -> None:
    oversized = OutputSpec(width_px=20000, height_px=20000, ppi=1440, lpi=60)

    try:
        oversized.validate_against(EUFYMAKE_E1_PRESET)
    except ValueError as exc:
        assert "exceeds eufyMake E1 printable area" in str(exc)
    else:
        raise AssertionError("expected E1 bed validation to fail")



def test_build_phase_strip_returns_correct_dimensions() -> None:
    red = solid(8, 4, (255, 0, 0))
    blue = solid(8, 4, (0, 0, 255))
    base_spec = OutputSpec(width_px=8, height_px=4, ppi=8, lpi=2, orientation="vertical")
    phases = [-0.25, 0.0, 0.25]

    interlaced_strip, depth_strip = build_phase_strip([red, blue], base_spec=base_spec, phases=phases)

    assert interlaced_strip.mode == "RGB"
    assert interlaced_strip.size == (8 * 3, 4)
    assert depth_strip.mode == "I;16"
    assert depth_strip.size == (8 * 3, 4)


def test_build_phase_strip_different_phases_produce_different_columns() -> None:
    red = solid(8, 4, (255, 0, 0))
    blue = solid(8, 4, (0, 0, 255))
    base_spec = OutputSpec(width_px=8, height_px=4, ppi=8, lpi=2, orientation="vertical")

    strip, _ = build_phase_strip([red, blue], base_spec=base_spec, phases=[-0.25, 0.25])

    arr = np.asarray(strip)
    # Bottom rows (below label area) of block 0 and block 1 should differ
    block0_col = arr[3, 0]
    block1_col = arr[3, 8]
    assert not np.array_equal(block0_col, block1_col)
