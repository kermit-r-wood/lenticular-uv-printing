import { describe, expect, it } from "vitest";
import { lensPeriodPx, sizePxFromMm, mod } from "../src/core/geom";

describe("lensPeriodPx", () => {
  it("uses ppi divided by lpi (matches Python test)", () => {
    expect(lensPeriodPx({ ppi: 1440, lpi: 60 })).toBe(24);
    expect(lensPeriodPx({ ppi: 1200, lpi: 75 })).toBe(16);
  });

  it("clamps to at least 1 even for very small ppi/lpi ratios", () => {
    expect(lensPeriodPx({ ppi: 10, lpi: 100 })).toBe(1);
  });

  it("rejects non-positive inputs", () => {
    expect(() => lensPeriodPx({ ppi: 0, lpi: 60 })).toThrow();
    expect(() => lensPeriodPx({ ppi: 1440, lpi: 0 })).toThrow();
  });
});

describe("sizePxFromMm", () => {
  it("converts millimeters to pixels at the given ppi", () => {
    // From test_cli: 10mm x 5mm @ 1440 ppi -> 567 x 283
    expect(sizePxFromMm(10, 5, 1440)).toEqual([567, 283]);
    // 50mm @ 1440 ppi -> round(50/25.4*1440) = 2835
    expect(sizePxFromMm(50, 50, 1440)).toEqual([2835, 2835]);
  });

  it("rejects non-positive inputs", () => {
    expect(() => sizePxFromMm(0, 5, 1440)).toThrow();
    expect(() => sizePxFromMm(10, -1, 1440)).toThrow();
    expect(() => sizePxFromMm(10, 5, 0)).toThrow();
  });
});

describe("mod", () => {
  it("returns non-negative results for negative dividends (matches numpy %)", () => {
    expect(mod(-1, 4)).toBe(3);
    expect(mod(-5, 4)).toBe(3);
    expect(mod(7, 4)).toBe(3);
  });

  it("works for floats", () => {
    expect(mod(-0.25 * 24, 24)).toBeCloseTo(18, 10);
  });
});
