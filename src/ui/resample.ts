import pica from "pica";
import type { RgbFrame } from "../core/interlace";

let _instance: ReturnType<typeof pica> | null = null;
function getPica(): ReturnType<typeof pica> {
  if (_instance === null) _instance = pica();
  return _instance;
}

/** Decode a File into an ImageBitmap (browser-native, no DOM canvas needed). */
export async function decodeFile(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

/**
 * Resize an ImageBitmap to the target pixel dimensions using Lanczos3
 * (via pica). Returns a tightly packed RGB buffer (no alpha).
 */
export async function resampleToRgb(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<RgbFrame> {
  const src = document.createElement("canvas");
  src.width = bitmap.width;
  src.height = bitmap.height;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Canvas 2D context not available");
  sctx.drawImage(bitmap, 0, 0);

  const dst = document.createElement("canvas");
  dst.width = targetWidth;
  dst.height = targetHeight;

  await getPica().resize(src, dst, { quality: 3 });

  const dctx = dst.getContext("2d", { willReadFrequently: true });
  if (!dctx) throw new Error("Canvas 2D context not available");
  const rgba = dctx.getImageData(0, 0, targetWidth, targetHeight).data;

  const rgb = new Uint8Array(targetWidth * targetHeight * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i] as number;
    rgb[j + 1] = rgba[i + 1] as number;
    rgb[j + 2] = rgba[i + 2] as number;
  }
  return { width: targetWidth, height: targetHeight, data: rgb };
}
