from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

from PIL import Image

from lenticular_raster.core import (
    EUFYMAKE_E1_PRESET,
    DEFAULT_PHASES,
    DepthProfile,
    Orientation,
    OutputSpec,
    build_phase_strip,
    generate_depth_map,
    interlace_images,
    size_px_from_mm,
    spec_from_images,
)
from lenticular_raster.image_io import save_png_with_dpi


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ValueError as exc:
        parser.error(str(exc))
        return 2


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lenticular-raster",
        description="Generate lenticular interlaced images and 16-bit UV gloss depth maps.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    make = subparsers.add_parser(
        "make",
        help="create an interlaced image and optional matching depth map from input images",
    )
    _add_common_print_args(make)
    make.add_argument("--input", action="append", required=True, help="input image; repeat for each view")
    make.add_argument("--out-interlaced", required=True, help="output interlaced PNG path")
    make.add_argument("--out-depth", help="optional matching 16-bit grayscale depth PNG path")
    make.add_argument("--width-mm", type=float, help="optional output width in millimeters")
    make.add_argument("--height-mm", type=float, help="optional output height in millimeters")
    make.set_defaults(func=_make)

    depth = subparsers.add_parser(
        "depth",
        help="create a standalone 16-bit grayscale lenticular depth map",
    )
    _add_common_print_args(depth)
    depth.add_argument("--out-depth", required=True, help="output 16-bit grayscale depth PNG path")
    depth.add_argument("--width-mm", type=float, required=True, help="output width in millimeters")
    depth.add_argument("--height-mm", type=float, required=True, help="output height in millimeters")
    depth.set_defaults(func=_depth)

    calibrate = subparsers.add_parser(
        "calibrate",
        help="create a phase calibration strip tiling multiple phase values side by side",
    )
    _add_common_print_args(calibrate)
    calibrate.add_argument("--input", action="append", required=True, help="input image; repeat for each view")
    calibrate.add_argument("--out-interlaced", required=True, help="output interlaced strip PNG path")
    calibrate.add_argument("--out-depth", required=True, help="output depth strip PNG path")
    calibrate.add_argument("--block-mm", type=float, default=20.0, help="width and height of each phase block in mm")
    calibrate.add_argument(
        "--phases",
        default=",".join(str(p) for p in DEFAULT_PHASES),
        help="comma-separated phase values in lens pitches (default: -0.25,-0.125,0,0.125,0.25)",
    )
    calibrate.set_defaults(func=_calibrate)

    return parser


def _add_common_print_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--ppi", type=int, default=EUFYMAKE_E1_PRESET.ppi, help="output pixels per inch")
    parser.add_argument("--lpi", type=float, default=60.0, help="lenticular lines per inch")
    parser.add_argument(
        "--orientation",
        choices=["vertical", "horizontal"],
        default="vertical",
        help="lens direction; vertical creates left-right view changes",
    )
    parser.add_argument(
        "--phase",
        type=float,
        default=0.0,
        help="phase offset measured in lens pitches, e.g. -0.125 or 0.25",
    )
    parser.add_argument(
        "--profile",
        choices=["sine", "arc"],
        default="sine",
        help="depth profile shape within one lenticular pitch",
    )
    parser.add_argument(
        "--max-depth-value",
        type=int,
        default=65535,
        help="maximum 16-bit grayscale value for the gloss/depth channel",
    )
    parser.add_argument(
        "--skip-e1-bed-check",
        action="store_true",
        help="allow dimensions larger than the eufyMake E1 flatbed printable area",
    )


def _make(args: argparse.Namespace) -> int:
    images = [Image.open(path) for path in args.input]
    spec = spec_from_images(
        images,
        ppi=args.ppi,
        lpi=args.lpi,
        width_mm=args.width_mm,
        height_mm=args.height_mm,
        orientation=_orientation(args.orientation),
        phase_pitch=args.phase,
        depth_profile=_profile(args.profile),
    )
    _validate_e1_bed(spec, args.skip_e1_bed_check)

    interlaced = interlace_images(images, spec)
    save_png_with_dpi(interlaced, Path(args.out_interlaced), ppi=spec.ppi)

    if args.out_depth:
        depth = generate_depth_map(spec, max_value=args.max_depth_value)
        save_png_with_dpi(depth, Path(args.out_depth), ppi=spec.ppi)
    return 0


def _depth(args: argparse.Namespace) -> int:
    width_px, height_px = size_px_from_mm(args.width_mm, args.height_mm, args.ppi)
    spec = OutputSpec(
        width_px=width_px,
        height_px=height_px,
        ppi=args.ppi,
        lpi=args.lpi,
        orientation=_orientation(args.orientation),
        phase_pitch=args.phase,
        depth_profile=_profile(args.profile),
    )
    _validate_e1_bed(spec, args.skip_e1_bed_check)

    depth = generate_depth_map(spec, max_value=args.max_depth_value)
    save_png_with_dpi(depth, Path(args.out_depth), ppi=spec.ppi)
    return 0


def _calibrate(args: argparse.Namespace) -> int:
    phases = [float(p.strip()) for p in args.phases.split(",")]
    images = [Image.open(path) for path in args.input]
    block_px, _ = size_px_from_mm(args.block_mm, args.block_mm, args.ppi)
    base_spec = OutputSpec(
        width_px=block_px,
        height_px=block_px,
        ppi=args.ppi,
        lpi=args.lpi,
        orientation=_orientation(args.orientation),
        phase_pitch=0.0,
        depth_profile=_profile(args.profile),
    )
    if not args.skip_e1_bed_check:
        from lenticular_raster.core import OutputSpec as _OS, MM_PER_INCH
        strip_mm = block_px * len(phases) / args.ppi * MM_PER_INCH
        strip_spec = OutputSpec(
            width_px=block_px * len(phases),
            height_px=block_px,
            ppi=args.ppi,
            lpi=args.lpi,
        )
        strip_spec.validate_against(EUFYMAKE_E1_PRESET)

    interlaced_strip, depth_strip = build_phase_strip(
        images, base_spec=base_spec, phases=phases, max_depth_value=args.max_depth_value
    )
    save_png_with_dpi(interlaced_strip, Path(args.out_interlaced), ppi=args.ppi)
    save_png_with_dpi(depth_strip, Path(args.out_depth), ppi=args.ppi)
    return 0


def _validate_e1_bed(spec: OutputSpec, skip: bool) -> None:
    if not skip:
        spec.validate_against(EUFYMAKE_E1_PRESET)


def _orientation(value: str) -> Orientation:
    if value not in ("vertical", "horizontal"):
        raise ValueError("orientation must be vertical or horizontal")
    return value


def _profile(value: str) -> DepthProfile:
    if value not in ("sine", "arc"):
        raise ValueError("profile must be sine or arc")
    return value


if __name__ == "__main__":
    raise SystemExit(main())
