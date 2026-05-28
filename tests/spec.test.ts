import { describe, expect, it } from "vitest";
import {
  BedExceededError,
  checkSoftLimit,
  EUFYMAKE_E1_PRESET,
  validateAgainstPreset,
  validateSpec,
  widthMm,
  heightMm,
  type OutputSpec,
} from "../src/core/spec";

const baseSpec = (over: Partial<OutputSpec> = {}): OutputSpec => ({
  widthPx: 100,
  heightPx: 100,
  ppi: 1440,
  lpi: 60,
  orientation: "vertical",
  phasePitch: 0,
  depthProfile: "sine",
  ...over,
});

describe("EUFYMAKE_E1_PRESET", () => {
  it("matches the official spec used by Python", () => {
    expect(EUFYMAKE_E1_PRESET.ppi).toBe(1440);
    expect(EUFYMAKE_E1_PRESET.maxWidthMm).toBe(330);
    expect(EUFYMAKE_E1_PRESET.maxHeightMm).toBe(420);
    expect(EUFYMAKE_E1_PRESET.maxEmbossHeightMm).toBe(5);
  });
});

describe("widthMm / heightMm", () => {
  it("inverts size_px_from_mm at the same ppi", () => {
    const spec = baseSpec({ widthPx: 2835, heightPx: 2835, ppi: 1440 });
    expect(widthMm(spec)).toBeCloseTo(50.0, 1);
    expect(heightMm(spec)).toBeCloseTo(50.0, 1);
  });
});

describe("validateSpec", () => {
  it("accepts a normal spec", () => {
    expect(() => validateSpec(baseSpec())).not.toThrow();
  });

  it("rejects non-positive dimensions", () => {
    expect(() => validateSpec(baseSpec({ widthPx: 0 }))).toThrow();
    expect(() => validateSpec(baseSpec({ heightPx: -1 }))).toThrow();
  });

  it("rejects bad ppi/lpi", () => {
    expect(() => validateSpec(baseSpec({ ppi: 0 }))).toThrow();
    expect(() => validateSpec(baseSpec({ lpi: 0 }))).toThrow();
  });
});

describe("validateAgainstPreset", () => {
  it("throws BedExceededError carrying structured info", () => {
    const oversized = baseSpec({ widthPx: 20000, heightPx: 20000 });
    let err: unknown;
    try {
      validateAgainstPreset(oversized, EUFYMAKE_E1_PRESET);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BedExceededError);
    if (err instanceof BedExceededError) {
      expect(err.code).toBe("BED_EXCEEDED");
      expect(err.preset.name).toBe("eufyMake E1");
      expect(err.widthMmValue).toBeGreaterThan(330);
      expect(err.message).toMatch(/exceeds eufyMake E1 printable area/);
    }
  });

  it("accepts a print that fits in the bed", () => {
    const ok = baseSpec({ widthPx: 2835, heightPx: 2835 }); // 50 x 50 mm
    expect(() => validateAgainstPreset(ok, EUFYMAKE_E1_PRESET)).not.toThrow();
  });
});

describe("checkSoftLimit", () => {
  it("returns null below 100mm", () => {
    expect(checkSoftLimit(baseSpec({ widthPx: 2835, heightPx: 2835 }))).toBeNull();
  });

  it("returns structured info above 100mm without throwing", () => {
    const big = baseSpec({ widthPx: 6000, heightPx: 6000 }); // ~105 mm
    const info = checkSoftLimit(big);
    expect(info).not.toBeNull();
    expect(info!.softMaxMm).toBe(100);
    expect(info!.widthMm).toBeGreaterThan(100);
    expect(info!.heightMm).toBeGreaterThan(100);
  });
});
