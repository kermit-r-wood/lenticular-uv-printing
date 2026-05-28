import { mod } from "./geom";

/**
 * For each integer coord, return the frame index it belongs to under a
 * lenticular pitch of `period` pixels and `phasePitch` offset.
 *
 * Mirrors Python `_frame_indices`:
 *   u = ((coords + phase_pitch * period) % period) / period
 *   indices = floor(u * frame_count)  clipped to [0, frame_count-1]
 */
export function frameIndices(
  coordCount: number,
  period: number,
  frameCount: number,
  phasePitch: number,
): Int32Array {
  if (coordCount <= 0) throw new Error("coordCount must be positive");
  if (period <= 0) throw new Error("period must be positive");
  if (frameCount <= 0) throw new Error("frameCount must be positive");

  const result = new Int32Array(coordCount);
  const offset = phasePitch * period;
  for (let i = 0; i < coordCount; i++) {
    const u = mod(i + offset, period) / period;
    let idx = Math.floor(u * frameCount);
    if (idx < 0) idx = 0;
    else if (idx > frameCount - 1) idx = frameCount - 1;
    result[i] = idx;
  }
  return result;
}

/**
 * Compute the periodic depth profile across one pitch.
 *
 *   sine: (1 - cos(2π u)) / 2 — smooth, low at edges, high at center
 *   arc : normalized circular cap (radius=0.75, half-pitch=0.5)
 *
 * Returns an array of length `period` with values in [0, 1].
 */
export function periodProfile(
  period: number,
  phasePitch: number,
  kind: "sine" | "arc",
): Float64Array {
  if (period <= 0) throw new Error("period must be positive");
  const out = new Float64Array(period);
  const offset = phasePitch * period;
  if (kind === "sine") {
    for (let i = 0; i < period; i++) {
      const u = mod(i + offset, period) / period;
      out[i] = (1 - Math.cos(2 * Math.PI * u)) / 2;
    }
    return out;
  }
  // arc
  const halfPitch = 0.5;
  const radius = 0.75;
  const edgeHeight = Math.sqrt(radius * radius - halfPitch * halfPitch);
  let peak = 0;
  for (let i = 0; i < period; i++) {
    const u = mod(i + offset, period) / period;
    const x = Math.abs(u - halfPitch);
    const inside = radius * radius - x * x;
    const h = inside > 0 ? Math.sqrt(inside) - edgeHeight : 0;
    out[i] = h;
    if (h > peak) peak = h;
  }
  if (peak > 0) {
    const inv = 1 / peak;
    for (let i = 0; i < period; i++) {
      out[i] = (out[i] as number) * inv;
    }
  }
  return out;
}
