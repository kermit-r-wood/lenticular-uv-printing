import { MM_PER_INCH } from "./geom";

export type Orientation = "vertical" | "horizontal";
export type DepthProfile = "sine" | "arc";

export interface PrinterPreset {
  readonly name: string;
  readonly ppi: number;
  readonly maxWidthMm: number;
  readonly maxHeightMm: number;
  readonly maxEmbossHeightMm: number;
}

export const EUFYMAKE_E1_PRESET: PrinterPreset = Object.freeze({
  name: "eufyMake E1",
  ppi: 1440,
  maxWidthMm: 330,
  maxHeightMm: 420,
  maxEmbossHeightMm: 5,
});

/**
 * Soft cap for the first browser release. Beyond this we warn but still
 * proceed — the UI shows a localized message based on `checkSoftLimit`.
 */
export const SOFT_MAX_DIM_MM = 100;

export interface OutputSpec {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly ppi: number;
  readonly lpi: number;
  readonly orientation: Orientation;
  readonly phasePitch: number;
  readonly depthProfile: DepthProfile;
}

export function widthMm(spec: OutputSpec): number {
  return (spec.widthPx / spec.ppi) * MM_PER_INCH;
}

export function heightMm(spec: OutputSpec): number {
  return (spec.heightPx / spec.ppi) * MM_PER_INCH;
}

export function validateSpec(spec: OutputSpec): void {
  if (spec.widthPx <= 0 || spec.heightPx <= 0) {
    throw new Error("output dimensions must be positive");
  }
  if (spec.ppi <= 0) throw new Error("ppi must be positive");
  if (spec.lpi <= 0) throw new Error("lpi must be positive");
  if (spec.orientation !== "vertical" && spec.orientation !== "horizontal") {
    throw new Error("orientation must be vertical or horizontal");
  }
  if (spec.depthProfile !== "sine" && spec.depthProfile !== "arc") {
    throw new Error("depth profile must be sine or arc");
  }
}

/** Thrown by `validateAgainstPreset` when output exceeds the printable bed. */
export class BedExceededError extends Error {
  readonly code = "BED_EXCEEDED" as const;
  constructor(
    readonly widthMmValue: number,
    readonly heightMmValue: number,
    readonly preset: PrinterPreset,
  ) {
    super(
      `output size ${widthMmValue.toFixed(2)}mm x ${heightMmValue.toFixed(2)}mm ` +
        `exceeds ${preset.name} printable area ` +
        `${preset.maxWidthMm}mm x ${preset.maxHeightMm}mm`,
    );
    this.name = "BedExceededError";
  }
}

export function validateAgainstPreset(
  spec: OutputSpec,
  preset: PrinterPreset,
): void {
  validateSpec(spec);
  const w = widthMm(spec);
  const h = heightMm(spec);
  if (w > preset.maxWidthMm || h > preset.maxHeightMm) {
    throw new BedExceededError(w, h, preset);
  }
}

export interface SoftLimitInfo {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly softMaxMm: number;
}

/** Returns structured info if the spec exceeds the soft limit, else null. */
export function checkSoftLimit(spec: OutputSpec): SoftLimitInfo | null {
  const w = widthMm(spec);
  const h = heightMm(spec);
  if (w > SOFT_MAX_DIM_MM || h > SOFT_MAX_DIM_MM) {
    return { widthMm: w, heightMm: h, softMaxMm: SOFT_MAX_DIM_MM };
  }
  return null;
}
