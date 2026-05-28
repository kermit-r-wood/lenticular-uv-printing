import { describe, expect, it } from "vitest";
import {
  buildCalibrationGrid,
  formatLabel,
} from "../src/core/calibrate";
import { makeSolidFrame } from "../src/core/interlace";
import type { OutputSpec } from "../src/core/spec";

function baseSpec(over: Partial<OutputSpec> = {}): OutputSpec {
  return {
    widthPx: 8,
    heightPx: 4,
    ppi: 8,
    lpi: 2,
    orientation: "vertical",
    phasePitch: 0,
    depthProfile: "sine",
    ...over,
  };
}

describe("buildCalibrationGrid", () => {
  it("returns dimensions cols=phases x rows=lpis (matches Python golden test)", () => {
    const red = makeSolidFrame(8, 4, 255, 0, 0);
    const blue = makeSolidFrame(8, 4, 0, 0, 255);

    const grid = buildCalibrationGrid([red, blue], {
      baseSpec: baseSpec(),
      lpis: [2, 4],
      phases: [0, 0.25],
    });

    expect(grid.interlaced.width).toBe(8 * 2);
    expect(grid.interlaced.height).toBe(4 * 2);
    expect(grid.depth.width).toBe(8 * 2);
    expect(grid.depth.height).toBe(4 * 2);
    expect(grid.labels.length).toBe(2 * 2);
  });

  it("produces different bottom-row pixels for different phases", () => {
    // Mirrors test_build_phase_strip_different_phases_produce_different_columns.
    const red = makeSolidFrame(8, 4, 255, 0, 0);
    const blue = makeSolidFrame(8, 4, 0, 0, 255);

    const grid = buildCalibrationGrid([red, blue], {
      baseSpec: baseSpec(),
      lpis: [2],
      phases: [-0.25, 0.25],
    });

    const stride = grid.interlaced.width * 3;
    // bottom row (y=3) of block 0 (x=0) vs block 1 (x=8)
    const block0 = (x: number) => {
      const i = 3 * stride + x * 3;
      return [
        grid.interlaced.data[i],
        grid.interlaced.data[i + 1],
        grid.interlaced.data[i + 2],
      ];
    };
    expect(block0(0)).not.toEqual(block0(8));
  });

  it("fills a solid gloss bar at the top of every depth block", () => {
    const red = makeSolidFrame(8, 4, 255, 0, 0);
    const blue = makeSolidFrame(8, 4, 0, 0, 255);
    const maxDepthValue = 50000;

    const grid = buildCalibrationGrid([red, blue], {
      baseSpec: baseSpec(),
      lpis: [2, 4],
      phases: [0, 0.25],
      maxDepthValue,
      labelBarPx: 2,
    });

    const w = grid.depth.width;
    // Every block: rows 0..1 of that block should be == maxDepthValue.
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const blockOx = col * 8;
        const blockOy = row * 4;
        for (let by = 0; by < 2; by++) {
          for (let bx = 0; bx < 8; bx++) {
            const v = grid.depth.data[(blockOy + by) * w + (blockOx + bx)];
            expect(v).toBe(maxDepthValue);
          }
        }
      }
    }
  });

  it("places each label at +2,+2 inside its block", () => {
    const red = makeSolidFrame(8, 4, 255, 0, 0);
    const blue = makeSolidFrame(8, 4, 0, 0, 255);

    const grid = buildCalibrationGrid([red, blue], {
      baseSpec: baseSpec(),
      lpis: [40, 60],
      phases: [-0.125, 0, 0.125],
    });

    expect(grid.labels.length).toBe(6);
    expect(grid.labels[0]).toEqual({ x: 2, y: 2, text: "40lpi \u03c6=-0.125" });
    expect(grid.labels[1]).toEqual({ x: 8 + 2, y: 2, text: "40lpi \u03c6=+0.000" });
    expect(grid.labels[5]).toEqual({ x: 16 + 2, y: 4 + 2, text: "60lpi \u03c6=+0.125" });
  });

  it("rejects empty lpis or phases", () => {
    const red = makeSolidFrame(8, 4, 255, 0, 0);
    expect(() =>
      buildCalibrationGrid([red], { baseSpec: baseSpec(), lpis: [], phases: [0] }),
    ).toThrow();
    expect(() =>
      buildCalibrationGrid([red], { baseSpec: baseSpec(), lpis: [60], phases: [] }),
    ).toThrow();
  });
});

describe("formatLabel", () => {
  it("matches Python f-string output for common values", () => {
    expect(formatLabel(60, 0)).toBe("60lpi \u03c6=+0.000");
    expect(formatLabel(40, -0.125)).toBe("40lpi \u03c6=-0.125");
    expect(formatLabel(30, 0.25)).toBe("30lpi \u03c6=+0.250");
  });
});
