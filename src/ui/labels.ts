import type { CalibrationLabel } from "../core/calibrate";
import type { RgbFrame } from "../core/interlace";

/**
 * Draw text labels onto an RGB frame using a Canvas overlay.
 * Returns a new RgbFrame with the labels burned in.
 */
export function drawLabelsOnRgb(
  frame: RgbFrame,
  labels: readonly CalibrationLabel[],
): RgbFrame {
  const { width, height } = frame;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context not available");

  // Paint the existing pixels as RGBA.
  const imageData = ctx.createImageData(width, height);
  const dst = imageData.data;
  const src = frame.data;
  for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
    dst[j] = src[i] as number;
    dst[j + 1] = src[i + 1] as number;
    dst[j + 2] = src[i + 2] as number;
    dst[j + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // White text, top-left aligned at (label.x, label.y) inside each block.
  ctx.font = "11px 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif";
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  for (const lbl of labels) {
    ctx.fillText(lbl.text, lbl.x, lbl.y);
  }

  // Read back as RGB.
  const out = ctx.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
    rgb[j] = out[i] as number;
    rgb[j + 1] = out[i + 1] as number;
    rgb[j + 2] = out[i + 2] as number;
  }
  return { width, height, data: rgb };
}
