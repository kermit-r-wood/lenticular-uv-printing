import { zlibSync } from "fflate";
import { crc32Concat } from "./crc32";

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// PNG color types we use.
const COLOR_TYPE_GRAY = 0;
const COLOR_TYPE_RGB = 2;

const METERS_PER_INCH = 0.0254;

/**
 * Encode an 8-bit RGB image. `data.length` must equal `width * height * 3`,
 * row-major, no row padding.
 */
export function encodeRgb8(
  data: Uint8Array,
  width: number,
  height: number,
  opts: { ppi?: number } = {},
): Uint8Array {
  if (data.length !== width * height * 3) {
    throw new Error(
      `encodeRgb8: data length ${data.length} != ${width * height * 3}`,
    );
  }
  const ihdr = buildIhdr(width, height, 8, COLOR_TYPE_RGB);
  const idat = buildIdatRgb8(data, width, height);
  return assemble(ihdr, idat, opts.ppi);
}

/**
 * Encode a 16-bit grayscale image. `data.length` must equal `width * height`.
 * Stored as big-endian samples per the PNG spec.
 */
export function encodeGray16(
  data: Uint16Array,
  width: number,
  height: number,
  opts: { ppi?: number } = {},
): Uint8Array {
  if (data.length !== width * height) {
    throw new Error(
      `encodeGray16: data length ${data.length} != ${width * height}`,
    );
  }
  const ihdr = buildIhdr(width, height, 16, COLOR_TYPE_GRAY);
  const idat = buildIdatGray16(data, width, height);
  return assemble(ihdr, idat, opts.ppi);
}

function buildIhdr(
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width, false);
  dv.setUint32(4, height, false);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: standard
  ihdr[12] = 0; // interlace: none
  return ihdr;
}

function buildPhys(ppi: number): Uint8Array {
  const ppm = Math.round(ppi / METERS_PER_INCH);
  const buf = new Uint8Array(9);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, ppm, false);
  dv.setUint32(4, ppm, false);
  buf[8] = 1; // unit: meters
  return buf;
}

function buildIdatRgb8(data: Uint8Array, width: number, height: number): Uint8Array {
  // Filter byte (0 = None) prepended to each scanline of width*3 bytes.
  const stride = width * 3;
  const filtered = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const dst = y * (stride + 1);
    filtered[dst] = 0;
    filtered.set(data.subarray(y * stride, y * stride + stride), dst + 1);
  }
  return zlibSync(filtered, { level: 6 });
}

function buildIdatGray16(
  data: Uint16Array,
  width: number,
  height: number,
): Uint8Array {
  // 16-bit samples: 2 bytes per pixel, big-endian.
  const stride = width * 2;
  const filtered = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    let dst = y * (stride + 1);
    filtered[dst++] = 0; // filter
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      const v = data[rowStart + x] as number;
      filtered[dst++] = (v >>> 8) & 0xff;
      filtered[dst++] = v & 0xff;
    }
  }
  return zlibSync(filtered, { level: 6 });
}

function assemble(ihdr: Uint8Array, idat: Uint8Array, ppi: number | undefined): Uint8Array {
  const chunks: Uint8Array[] = [];
  chunks.push(PNG_SIGNATURE);
  chunks.push(makeChunk("IHDR", ihdr));
  if (ppi !== undefined) {
    chunks.push(makeChunk("pHYs", buildPhys(ppi)));
  }
  chunks.push(makeChunk("IDAT", idat));
  chunks.push(makeChunk("IEND", new Uint8Array(0)));
  return concat(chunks);
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  if (type.length !== 4) throw new Error("chunk type must be 4 ASCII chars");
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const out = new Uint8Array(8 + data.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length, false);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crc = crc32Concat([typeBytes, data]);
  dv.setUint32(8 + data.length, crc, false);
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
