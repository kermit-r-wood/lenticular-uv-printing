import { describe, expect, it } from "vitest";
import { generateDepthMap } from "../src/core/depth";
import type { OutputSpec } from "../src/core/spec";

function spec(over: Partial<OutputSpec> = {}): OutputSpec {
  return {
    widthPx: 8,
    heightPx: 2,
    ppi: 8,
    lpi: 2,
    orientation: "vertical",
    phasePitch: 0,
    depthProfile: "sine",
    ...over,
  };
}

describe("generateDepthMap", () => {
  it("matches the Python golden test for a 2-pitch sine line", () => {
    // Mirrors: test_depth_map_is_16_bit_repeating_low_high_low_lens_profile.
    // ppi=8 lpi=2 -> period=4. Sine: low at u=0, high at u=0.5.
    const depth = generateDepthMap(spec(), { maxValue: 65535 });
    expect(depth.width).toBe(8);
    expect(depth.height).toBe(2);

    const col = (x: number, y: number) => depth.data[y * 8 + x] as number;
    expect(col(0, 0)).toBeLessThan(10000);
    expect(col(2, 0)).toBeGreaterThan(55000);
    expect(col(4, 0)).toBeLessThan(10000);
    expect(col(6, 0)).toBeGreaterThan(55000);
    // Vertical orientation: every row identical.
    for (let x = 0; x < 8; x++) {
      expect(col(x, 1)).toBe(col(x, 0));
    }
  });

  it("clips the maxValue parameter into the 16-bit range", () => {
    const halfMax = 32768;
    const depth = generateDepthMap(spec(), { maxValue: halfMax });
    let max = 0;
    for (const v of depth.data) {
      if (v > max) max = v;
    }
    expect(max).toBeLessThanOrEqual(halfMax);
  });

  it("rejects invalid maxValue", () => {
    expect(() => generateDepthMap(spec(), { maxValue: 0 })).toThrow();
    expect(() => generateDepthMap(spec(), { maxValue: 70000 })).toThrow();
  });

  it("horizontal orientation tiles down columns instead of across rows", () => {
    const depth = generateDepthMap(
      spec({ widthPx: 2, heightPx: 8, orientation: "horizontal" }),
      { maxValue: 65535 },
    );
    const at = (x: number, y: number) => depth.data[y * 2 + x] as number;
    // Within a row, both columns equal.
    expect(at(0, 0)).toBe(at(1, 0));
    expect(at(0, 2)).toBe(at(1, 2));
    // Vertical pattern matches sine: low at y=0, high at y=2.
    expect(at(0, 0)).toBeLessThan(10000);
    expect(at(0, 2)).toBeGreaterThan(55000);
  });

  it("arc profile is also low-high-low across one pitch", () => {
    const depth = generateDepthMap(spec({ depthProfile: "arc" }), { maxValue: 65535 });
    const at = (x: number) => depth.data[x] as number;
    expect(at(0)).toBeLessThan(2000);
    expect(at(2)).toBe(65535); // arc peak
    expect(at(4)).toBeLessThan(2000);
  });
});
