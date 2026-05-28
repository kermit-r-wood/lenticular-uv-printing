import { describe, expect, it } from "vitest";
import { frameIndices, periodProfile } from "../src/core/profiles";

describe("frameIndices", () => {
  it("assigns frames within each pitch (vertical 2-frame, period=4)", () => {
    // From test_interlace_vertical_lenses_assigns_frames_by_column_within_period:
    // ppi=8 lpi=2 -> period=4, frames=[red, blue], width=8.
    // Expect cols 0..1 -> 0, 2..3 -> 1, 4..5 -> 0, 6..7 -> 1.
    const idx = frameIndices(8, 4, 2, 0);
    expect(Array.from(idx)).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });

  it("phase 0.5 swaps the halves of a 2-frame pitch", () => {
    // From test_interlace_phase_offset:
    // ppi=4 lpi=1 -> period=4, frames=[red, blue], phase=0.5
    // Expect cols 0..1 -> 1 (blue), 2..3 -> 0 (red).
    const idx = frameIndices(4, 4, 2, 0.5);
    expect(Array.from(idx)).toEqual([1, 1, 0, 0]);
  });

  it("clamps to last frame at the upper boundary", () => {
    // u=1 should never occur (mod), but floor(u * N) must always be in range.
    const idx = frameIndices(24, 24, 3, 0);
    for (const v of idx) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(2);
    }
  });

  it("3-frame split at period 24 is even", () => {
    const idx = Array.from(frameIndices(24, 24, 3, 0));
    expect(idx.slice(0, 8).every((v) => v === 0)).toBe(true);
    expect(idx.slice(8, 16).every((v) => v === 1)).toBe(true);
    expect(idx.slice(16, 24).every((v) => v === 2)).toBe(true);
  });
});

describe("periodProfile sine", () => {
  it("is 0 at u=0 and ~1 at u=0.5 (the pitch center)", () => {
    const p = periodProfile(8, 0, "sine");
    expect(p[0]).toBeCloseTo(0, 12);
    expect(p[4]).toBeCloseTo(1, 12);
    // Symmetric around center
    expect(p[1]).toBeCloseTo(p[7]!, 12);
    expect(p[3]).toBeCloseTo(p[5]!, 12);
  });

  it("matches the depth-map shape used in test_core (period=4)", () => {
    // ppi=8 lpi=2 -> period=4. Edges should be near 0, center near 1.
    const p = periodProfile(4, 0, "sine");
    expect(p[0]).toBeLessThan(0.05);
    expect(p[2]).toBeGreaterThan(0.95);
  });
});

describe("periodProfile arc", () => {
  it("is 0 at u=0/u=1 and 1 at u=0.5", () => {
    const p = periodProfile(100, 0, "arc");
    expect(p[0]).toBeCloseTo(0, 10);
    expect(p[50]).toBeCloseTo(1, 10);
    // Symmetric
    expect(p[10]).toBeCloseTo(p[90]!, 10);
  });

  it("monotonically increases up to the center for even periods", () => {
    const p = periodProfile(40, 0, "arc");
    for (let i = 1; i <= 20; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]! - 1e-12);
    }
  });
});
