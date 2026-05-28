/**
 * End-to-end sanity test: emit real PNG files to web/out/ so the user can
 * open them in Photoshop / eufyMake to confirm DPI, bit depth, and the
 * visual stripe pattern.
 *
 * Geometry mirrors the existing Python example (42mm x 42mm @ 1440 ppi @ 60 lpi)
 * so the resulting PNGs can be compared side-by-side with
 * examples/ab-flip/ab-flip-{interlaced,depth}-42mm-60lpi.png.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateDepthMap } from "../src/core/depth";
import { sizePxFromMm } from "../src/core/geom";
import { interlace, makeSolidFrame } from "../src/core/interlace";
import { EUFYMAKE_E1_PRESET, type OutputSpec } from "../src/core/spec";
import { encodeGray16, encodeRgb8 } from "../src/png/encode";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "out");

describe("e2e sanity fixture", () => {
  it("writes a 42mm x 42mm @ 1440ppi @ 60lpi flip pair to web/out/", () => {
    const ppi = EUFYMAKE_E1_PRESET.ppi;
    const lpi = 60;
    const [w, h] = sizePxFromMm(42, 42, ppi);

    const spec: OutputSpec = {
      widthPx: w,
      heightPx: h,
      ppi,
      lpi,
      orientation: "vertical",
      phasePitch: 0,
      depthProfile: "sine",
    };

    // Two views: one solid red ("A"), one solid blue ("B").
    // Solid colors are enough to verify the lens stripe pattern and DPI.
    const red = makeSolidFrame(w, h, 220, 50, 50);
    const blue = makeSolidFrame(w, h, 50, 80, 220);

    const interlaced = interlace([red, blue], spec);
    const depth = generateDepthMap(spec, { maxValue: 65535 });

    const interlacedPng = encodeRgb8(interlaced.data, w, h, { ppi });
    const depthPng = encodeGray16(depth.data, w, h, { ppi });

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, "sanity-interlaced.png"), interlacedPng);
    writeFileSync(join(OUT_DIR, "sanity-depth.png"), depthPng);

    // Cheap structural sanity assertions to keep this in the regular run.
    expect(interlacedPng.length).toBeGreaterThan(0);
    expect(depthPng.length).toBeGreaterThan(0);
    // PNG signature byte 0
    expect(interlacedPng[0]).toBe(0x89);
    expect(depthPng[0]).toBe(0x89);
  });
});
