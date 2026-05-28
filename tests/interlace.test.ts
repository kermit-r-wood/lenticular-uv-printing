import { describe, expect, it } from "vitest";
import { interlace, makeSolidFrame, type RgbFrame } from "../src/core/interlace";
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

function pixel(frame: RgbFrame, x: number, y: number): [number, number, number] {
  const i = (y * frame.width + x) * 3;
  return [frame.data[i] as number, frame.data[i + 1] as number, frame.data[i + 2] as number];
}

describe("interlace vertical", () => {
  it("assigns frames by column within each pitch (matches Python golden test)", () => {
    // ppi=8 lpi=2 -> period=4. 2 frames -> first half red, second half blue.
    const red = makeSolidFrame(8, 2, 255, 0, 0);
    const blue = makeSolidFrame(8, 2, 0, 0, 255);
    const out = interlace([red, blue], spec());

    expect(out.width).toBe(8);
    expect(out.height).toBe(2);
    // cols 0..1 -> red, 2..3 -> blue, 4..5 -> red, 6..7 -> blue
    expect(pixel(out, 0, 0)).toEqual([255, 0, 0]);
    expect(pixel(out, 1, 1)).toEqual([255, 0, 0]);
    expect(pixel(out, 2, 0)).toEqual([0, 0, 255]);
    expect(pixel(out, 3, 1)).toEqual([0, 0, 255]);
    expect(pixel(out, 4, 0)).toEqual([255, 0, 0]);
    expect(pixel(out, 6, 1)).toEqual([0, 0, 255]);
  });

  it("phase 0.5 swaps the halves of the pitch", () => {
    // ppi=4 lpi=1 -> period=4, phase=0.5: cols 0..1 -> blue, 2..3 -> red.
    const red = makeSolidFrame(4, 1, 255, 0, 0);
    const blue = makeSolidFrame(4, 1, 0, 0, 255);
    const out = interlace(
      [red, blue],
      spec({ widthPx: 4, heightPx: 1, ppi: 4, lpi: 1, phasePitch: 0.5 }),
    );

    expect(pixel(out, 0, 0)).toEqual([0, 0, 255]);
    expect(pixel(out, 1, 0)).toEqual([0, 0, 255]);
    expect(pixel(out, 2, 0)).toEqual([255, 0, 0]);
    expect(pixel(out, 3, 0)).toEqual([255, 0, 0]);
  });

  it("3 frames evenly distributed across a 24-column pitch", () => {
    const w = 24,
      h = 1;
    const a = makeSolidFrame(w, h, 10, 0, 0);
    const b = makeSolidFrame(w, h, 0, 20, 0);
    const c = makeSolidFrame(w, h, 0, 0, 30);
    const out = interlace(
      [a, b, c],
      spec({ widthPx: w, heightPx: h, ppi: 24, lpi: 1 }),
    );
    // First 8 cols -> a, next 8 -> b, last 8 -> c
    expect(pixel(out, 0, 0)).toEqual([10, 0, 0]);
    expect(pixel(out, 7, 0)).toEqual([10, 0, 0]);
    expect(pixel(out, 8, 0)).toEqual([0, 20, 0]);
    expect(pixel(out, 15, 0)).toEqual([0, 20, 0]);
    expect(pixel(out, 16, 0)).toEqual([0, 0, 30]);
    expect(pixel(out, 23, 0)).toEqual([0, 0, 30]);
  });
});

describe("interlace horizontal", () => {
  it("assigns frames by row within each pitch", () => {
    const red = makeSolidFrame(2, 8, 255, 0, 0);
    const blue = makeSolidFrame(2, 8, 0, 0, 255);
    const out = interlace(
      [red, blue],
      spec({ widthPx: 2, heightPx: 8, orientation: "horizontal" }),
    );
    // ppi=8 lpi=2 -> period=4. rows 0..1 -> red, 2..3 -> blue, 4..5 -> red, 6..7 -> blue
    expect(pixel(out, 0, 0)).toEqual([255, 0, 0]);
    expect(pixel(out, 1, 1)).toEqual([255, 0, 0]);
    expect(pixel(out, 0, 2)).toEqual([0, 0, 255]);
    expect(pixel(out, 1, 5)).toEqual([255, 0, 0]);
    expect(pixel(out, 0, 6)).toEqual([0, 0, 255]);
  });
});

describe("interlace input validation", () => {
  it("rejects frames whose dimensions don't match the spec", () => {
    const red = makeSolidFrame(8, 2, 255, 0, 0);
    expect(() => interlace([red], spec({ widthPx: 16 }))).toThrow(/match spec/);
  });

  it("rejects empty frame list", () => {
    expect(() => interlace([], spec())).toThrow();
  });
});
