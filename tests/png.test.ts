import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { encodeGray16, encodeRgb8 } from "../src/png/encode";
import { crc32 } from "../src/png/crc32";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface PngChunk {
  type: string;
  data: Uint8Array;
}

interface ParsedIhdr {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compression: number;
  filter: number;
  interlace: number;
}

function parsePng(buf: Uint8Array): {
  ihdr: ParsedIhdr;
  phys: { ppmX: number; ppmY: number; unit: number } | null;
  idat: Uint8Array;
  chunks: PngChunk[];
} {
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIG[i]) throw new Error("bad png signature");
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 8;
  const chunks: PngChunk[] = [];
  let phys: { ppmX: number; ppmY: number; unit: number } | null = null;
  let ihdr: ParsedIhdr | null = null;
  const idatParts: Uint8Array[] = [];

  while (p < buf.length) {
    const len = dv.getUint32(p, false);
    p += 4;
    const typeBytes = buf.subarray(p, p + 4);
    const type = String.fromCharCode(...typeBytes);
    p += 4;
    const data = buf.subarray(p, p + len);
    p += len;
    const crcStored = dv.getUint32(p, false);
    p += 4;
    // Verify CRC
    const crcCalc = crc32(buf.subarray(p - 4 - len - 4, p - 4));
    if (crcCalc !== crcStored) {
      throw new Error(`crc mismatch on chunk ${type}`);
    }
    chunks.push({ type, data });
    if (type === "IHDR") {
      const cdv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      ihdr = {
        width: cdv.getUint32(0, false),
        height: cdv.getUint32(4, false),
        bitDepth: data[8] as number,
        colorType: data[9] as number,
        compression: data[10] as number,
        filter: data[11] as number,
        interlace: data[12] as number,
      };
    } else if (type === "pHYs") {
      const cdv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      phys = {
        ppmX: cdv.getUint32(0, false),
        ppmY: cdv.getUint32(4, false),
        unit: data[8] as number,
      };
    } else if (type === "IDAT") {
      idatParts.push(new Uint8Array(data));
    } else if (type === "IEND") {
      break;
    }
  }
  if (!ihdr) throw new Error("no IHDR");
  // Concatenate IDATs and inflate
  const concatLen = idatParts.reduce((s, p) => s + p.length, 0);
  const merged = new Uint8Array(concatLen);
  let off = 0;
  for (const part of idatParts) {
    merged.set(part, off);
    off += part.length;
  }
  const idat = new Uint8Array(inflateSync(merged));
  return { ihdr, phys, idat, chunks };
}

describe("encodeRgb8", () => {
  it("produces a parseable PNG with correct IHDR", () => {
    const data = new Uint8Array([
      255, 0, 0,   0, 255, 0,   0, 0, 255,
      255, 255, 0, 0, 255, 255, 255, 0, 255,
    ]);
    const png = encodeRgb8(data, 3, 2);
    const parsed = parsePng(png);
    expect(parsed.ihdr.width).toBe(3);
    expect(parsed.ihdr.height).toBe(2);
    expect(parsed.ihdr.bitDepth).toBe(8);
    expect(parsed.ihdr.colorType).toBe(2); // RGB
    expect(parsed.ihdr.interlace).toBe(0);
  });

  it("round-trips pixel data after inflate + filter strip", () => {
    const data = new Uint8Array([
      10, 20, 30, 40, 50, 60,
      70, 80, 90, 100, 110, 120,
    ]);
    const png = encodeRgb8(data, 2, 2);
    const { idat } = parsePng(png);
    // idat: per row -> 1 filter byte + width*3 data bytes
    const stride = 2 * 3;
    expect(idat[0]).toBe(0); // filter row 0
    expect(Array.from(idat.subarray(1, 1 + stride))).toEqual([10, 20, 30, 40, 50, 60]);
    expect(idat[1 + stride]).toBe(0); // filter row 1
    expect(Array.from(idat.subarray(2 + stride, 2 + 2 * stride))).toEqual([
      70, 80, 90, 100, 110, 120,
    ]);
  });

  it("includes pHYs chunk with correct ppm conversion at 1440 ppi", () => {
    const data = new Uint8Array(3 * 2 * 3);
    const png = encodeRgb8(data, 3, 2, { ppi: 1440 });
    const { phys } = parsePng(png);
    expect(phys).not.toBeNull();
    // 1440 / 0.0254 = 56692.91... -> round -> 56693
    expect(phys!.ppmX).toBe(56693);
    expect(phys!.ppmY).toBe(56693);
    expect(phys!.unit).toBe(1);
  });

  it("omits pHYs when no ppi is given", () => {
    const data = new Uint8Array(3 * 2 * 3);
    const png = encodeRgb8(data, 3, 2);
    const { phys, chunks } = parsePng(png);
    expect(phys).toBeNull();
    expect(chunks.find((c) => c.type === "pHYs")).toBeUndefined();
  });
});

describe("encodeGray16", () => {
  it("produces a parseable PNG with correct IHDR", () => {
    const data = new Uint16Array([0, 32768, 65535, 1, 32767, 65534]);
    const png = encodeGray16(data, 3, 2);
    const { ihdr } = parsePng(png);
    expect(ihdr.width).toBe(3);
    expect(ihdr.height).toBe(2);
    expect(ihdr.bitDepth).toBe(16);
    expect(ihdr.colorType).toBe(0); // Gray
  });

  it("encodes samples big-endian", () => {
    const data = new Uint16Array([0x1234, 0xabcd]);
    const png = encodeGray16(data, 2, 1);
    const { idat } = parsePng(png);
    // 1 filter byte + 2*2 sample bytes
    expect(idat[0]).toBe(0);
    expect(idat[1]).toBe(0x12);
    expect(idat[2]).toBe(0x34);
    expect(idat[3]).toBe(0xab);
    expect(idat[4]).toBe(0xcd);
  });

  it("includes pHYs at 1440 ppi for the depth map use case", () => {
    const data = new Uint16Array(4);
    const png = encodeGray16(data, 2, 2, { ppi: 1440 });
    const { phys } = parsePng(png);
    expect(phys!.ppmX).toBe(56693);
    expect(phys!.ppmY).toBe(56693);
  });

  it("rejects buffers with the wrong length", () => {
    expect(() => encodeGray16(new Uint16Array(3), 2, 2)).toThrow();
  });
});

describe("crc32", () => {
  it("matches a known PNG IHDR CRC", () => {
    // IHDR for 1x1 8-bit RGB: type "IHDR" + data 00 00 00 01 00 00 00 01 08 02 00 00 00
    // Known PNG CRC for the above is 0x907753DE.
    const typeAndData = new Uint8Array([
      0x49, 0x48, 0x44, 0x52, // "IHDR"
      0x00, 0x00, 0x00, 0x01, // width 1
      0x00, 0x00, 0x00, 0x01, // height 1
      0x08, 0x02, 0x00, 0x00, 0x00,
    ]);
    expect(crc32(typeAndData)).toBe(0x907753de);
  });
});
