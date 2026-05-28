// CRC32 (PNG / zip / IEEE 802.3 polynomial 0xEDB88320).
// Lazily-initialized lookup table.

let TABLE: Uint32Array | null = null;

function getTable(): Uint32Array {
  if (TABLE !== null) return TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  TABLE = t;
  return t;
}

export function crc32(buf: Uint8Array): number {
  const t = getTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (t[(c ^ (buf[i] as number)) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function crc32Concat(parts: readonly Uint8Array[]): number {
  const t = getTable();
  let c = 0xffffffff;
  for (const buf of parts) {
    for (let i = 0; i < buf.length; i++) {
      c = (t[(c ^ (buf[i] as number)) & 0xff] as number) ^ (c >>> 8);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}
