from __future__ import annotations

from dataclasses import dataclass
from math import ceil, cos, pi, sqrt
from typing import Literal, Sequence

import numpy as np
from PIL import Image

Orientation = Literal["vertical", "horizontal"]
DepthProfile = Literal["sine", "arc"]

MM_PER_INCH = 25.4


@dataclass(frozen=True)
class PrinterPreset:
    name: str
    ppi: int
    max_width_mm: int
    max_height_mm: int
    max_emboss_height_mm: int


EUFYMAKE_E1_PRESET = PrinterPreset(
    name="eufyMake E1",
    ppi=1440,
    max_width_mm=330,
    max_height_mm=420,
    max_emboss_height_mm=5,
)


@dataclass(frozen=True)
class OutputSpec:
    width_px: int
    height_px: int
    ppi: int
    lpi: float
    orientation: Orientation = "vertical"
    phase_pitch: float = 0.0
    depth_profile: DepthProfile = "sine"

    @property
    def width_mm(self) -> float:
        return self.width_px / self.ppi * MM_PER_INCH

    @property
    def height_mm(self) -> float:
        return self.height_px / self.ppi * MM_PER_INCH

    def validate(self) -> None:
        if self.width_px <= 0 or self.height_px <= 0:
            raise ValueError("output dimensions must be positive")
        if self.ppi <= 0:
            raise ValueError("ppi must be positive")
        if self.lpi <= 0:
            raise ValueError("lpi must be positive")
        if self.orientation not in ("vertical", "horizontal"):
            raise ValueError("orientation must be vertical or horizontal")
        if self.depth_profile not in ("sine", "arc"):
            raise ValueError("depth profile must be sine or arc")

    def validate_against(self, preset: PrinterPreset) -> None:
        self.validate()
        if self.width_mm > preset.max_width_mm or self.height_mm > preset.max_height_mm:
            raise ValueError(
                f"output size {self.width_mm:.2f}mm x {self.height_mm:.2f}mm "
                f"exceeds {preset.name} printable area "
                f"{preset.max_width_mm}mm x {preset.max_height_mm}mm"
            )


def lens_period_px(*, ppi: int, lpi: float) -> int:
    if ppi <= 0:
        raise ValueError("ppi must be positive")
    if lpi <= 0:
        raise ValueError("lpi must be positive")
    return max(1, round(ppi / lpi))


def size_px_from_mm(width_mm: float, height_mm: float, ppi: int) -> tuple[int, int]:
    if width_mm <= 0 or height_mm <= 0:
        raise ValueError("physical dimensions must be positive")
    if ppi <= 0:
        raise ValueError("ppi must be positive")
    return round(width_mm / MM_PER_INCH * ppi), round(height_mm / MM_PER_INCH * ppi)


def spec_from_images(
    images: Sequence[Image.Image],
    *,
    ppi: int,
    lpi: float,
    width_mm: float | None = None,
    height_mm: float | None = None,
    orientation: Orientation = "vertical",
    phase_pitch: float = 0.0,
    depth_profile: DepthProfile = "sine",
) -> OutputSpec:
    if not images:
        raise ValueError("at least one input image is required")
    if width_mm is None and height_mm is None:
        width_px, height_px = images[0].size
    elif width_mm is not None and height_mm is not None:
        width_px, height_px = size_px_from_mm(width_mm, height_mm, ppi)
    else:
        raise ValueError("width-mm and height-mm must be provided together")
    spec = OutputSpec(
        width_px=width_px,
        height_px=height_px,
        ppi=ppi,
        lpi=lpi,
        orientation=orientation,
        phase_pitch=phase_pitch,
        depth_profile=depth_profile,
    )
    spec.validate()
    return spec


def interlace_images(images: Sequence[Image.Image], spec: OutputSpec) -> Image.Image:
    spec.validate()
    if not images:
        raise ValueError("at least one input image is required")

    frames = [
        image.convert("RGB").resize((spec.width_px, spec.height_px), Image.Resampling.LANCZOS)
        for image in images
    ]
    frame_arrays = np.stack([np.asarray(frame) for frame in frames], axis=0)
    frame_count = len(frames)
    period = lens_period_px(ppi=spec.ppi, lpi=spec.lpi)

    if spec.orientation == "vertical":
        coords = np.arange(spec.width_px)
        frame_indices = _frame_indices(coords, period, frame_count, spec.phase_pitch)
        result = frame_arrays[frame_indices, :, np.arange(spec.width_px), :]
        return Image.fromarray(np.transpose(result, (1, 0, 2)), "RGB")

    coords = np.arange(spec.height_px)
    frame_indices = _frame_indices(coords, period, frame_count, spec.phase_pitch)
    result = frame_arrays[frame_indices, np.arange(spec.height_px), :, :]
    return Image.fromarray(result, "RGB")


def generate_depth_map(spec: OutputSpec, *, max_value: int = 65535) -> Image.Image:
    spec.validate()
    if max_value <= 0 or max_value > 65535:
        raise ValueError("max depth value must be between 1 and 65535")

    period = lens_period_px(ppi=spec.ppi, lpi=spec.lpi)
    coord_count = spec.width_px if spec.orientation == "vertical" else spec.height_px
    coords = np.arange(coord_count, dtype=np.float64)
    u = ((coords + spec.phase_pitch * period) % period) / period

    if spec.depth_profile == "sine":
        profile = (1.0 - np.cos(2.0 * pi * u)) / 2.0
    else:
        profile = _arc_profile(u)

    line = np.clip(np.rint(profile * max_value), 0, 65535).astype(np.uint16)
    if spec.orientation == "vertical":
        depth = np.tile(line, (spec.height_px, 1))
    else:
        depth = np.tile(line[:, np.newaxis], (1, spec.width_px))
    return Image.fromarray(depth)


def _frame_indices(
    coords: np.ndarray,
    period: int,
    frame_count: int,
    phase_pitch: float,
) -> np.ndarray:
    u = ((coords + phase_pitch * period) % period) / period
    indices = np.floor(u * frame_count).astype(np.int64)
    return np.clip(indices, 0, frame_count - 1)


def _arc_profile(u: np.ndarray) -> np.ndarray:
    # Unit circular cap with low edges and high center, normalized to 0..1.
    half_pitch = 0.5
    radius = 0.75
    x = np.abs(u - half_pitch)
    edge_height = sqrt(radius**2 - half_pitch**2)
    heights = np.sqrt(np.maximum(radius**2 - x**2, 0.0)) - edge_height
    return heights / heights.max()
