/**
 * Payload format v1 (documented in docs/payload-format.md).
 *
 *   on the image (embed-core):  header { version(4 bits) | flags(4 bits), length(16), check } + Reed-Solomon, then the body
 *   body                      = content || CRC-32(content), big-endian
 *   content (flags & 1 == 0)  = UTF-8 text
 *   content (flags & 1 == 1)  = kdfId(1) || salt(16) || nonce(12) || AES-256-GCM ciphertext+tag
 *
 * There is no text marker and no metadata: a plain photograph and a Hush photograph look the same to a file inspector.
 */
export const FLAG_ENCRYPTED = 1;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildBody(content: Uint8Array): Uint8Array {
  const out = new Uint8Array(content.length + 4);
  out.set(content);
  new DataView(out.buffer).setUint32(content.length, crc32(content));
  return out;
}

/** Returns the content, or null if the check fails (never returns partial data). */
export function parseBody(body: Uint8Array): Uint8Array | null {
  if (body.length < 5) return null;
  const content = body.subarray(0, body.length - 4);
  const stored = new DataView(body.buffer, body.byteOffset + body.length - 4, 4).getUint32(0);
  return crc32(content) === stored ? content.slice() : null;
}

export const textToBytes = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Strict decode: invalid UTF-8 is a failure, not replacement characters. */
export function bytesToText(b: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return null;
  }
}
