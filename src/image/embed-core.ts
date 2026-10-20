/**
 * The embedding engine: quantisation-index-modulation (QIM) of mid-frequency 8x8 DCT coefficients of the luma channel.
 *
 * Why this survives JPEG: JPEG itself quantises exactly these coefficients on an 8x8 grid. We move each chosen coefficient
 * onto a lattice with a step larger than JPEG's own step there, so recompression moves it by less than half our step.
 * One bit is spread over many coefficients (random slots across the whole image) and decided by a soft vote, then
 * Reed-Solomon fixes what the vote gets wrong.
 *
 * Needs the 8x8 grid to be intact: the image must not be cropped or rescaled after encoding. See docs/algorithm-evaluation.md.
 *
 * Layout of the slots, in a keyed random order:  [ header: 96 bits x headerRepeat ][ body: n bits x R ]
 * Header = 4 bytes (version+flags, length, check) + 8 Reed-Solomon parity bytes. The decoder tries each step in
 * CONFIG.embed.steps until a header decodes and its check byte matches, so the step is not written anywhere.
 */
import { CONFIG, FORMAT_VERSION } from "../config";
import { parityFor, rsDecode, rsEncode } from "../payload/reed-solomon";
import { rng, shuffledIndices } from "./prng";
import { luma, type Raster } from "./pixels";

const K = CONFIG.embed.coefficients.length;
const HEADER_DATA = 4;
const HEADER_PARITY = 8;
const HEADER_BITS = (HEADER_DATA + HEADER_PARITY) * 8;

// ---- DCT basis for the chosen coefficients (orthonormal, as JPEG uses) ----

const cosTable = (() => {
  const t = new Float32Array(64);
  for (let u = 0; u < 8; u++) {
    const a = u === 0 ? Math.sqrt(1 / 8) : 0.5;
    for (let x = 0; x < 8; x++) t[u * 8 + x] = a * Math.cos(((2 * x + 1) * u * Math.PI) / 16);
  }
  return t;
})();

const basis: Float32Array[] = CONFIG.embed.coefficients.map(([u, v]) => {
  const b = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b[y * 8 + x] = cosTable[v * 8 + y] * cosTable[u * 8 + x];
  return b;
});

function coefficient(yPlane: Float32Array, stride: number, bx: number, by: number, k: number): number {
  const b = basis[k];
  let sum = 0;
  const base = by * 8 * stride + bx * 8;
  for (let y = 0; y < 8; y++) {
    const row = base + y * stride;
    for (let x = 0; x < 8; x++) sum += yPlane[row + x] * b[y * 8 + x];
  }
  return sum;
}

// ---- slot layout ----

interface Layout {
  blocksX: number;
  blocksY: number;
  slots: number;
  order: Uint32Array; // t -> slot index (block * K + k)
  dither: Float32Array; // slot index -> [0,1)
}

const layoutCache = new Map<string, Layout>();
function layoutFor(blocksX: number, blocksY: number): Layout {
  const key = `${blocksX}x${blocksY}`;
  let l = layoutCache.get(key);
  if (!l) {
    const slots = blocksX * blocksY * K;
    const r = rng(`${CONFIG.embed.seed}/dither/${key}`);
    const dither = new Float32Array(slots);
    for (let i = 0; i < slots; i++) dither[i] = r();
    l = { blocksX, blocksY, slots, order: shuffledIndices(slots, `${CONFIG.embed.seed}/order/${key}`), dither };
    if (layoutCache.size > 6) layoutCache.clear();
    layoutCache.set(key, l);
  }
  return l;
}

function whitening(n: number): Uint8Array {
  const r = rng(`${CONFIG.embed.seed}/white`);
  const w = new Uint8Array(n);
  for (let i = 0; i < n; i++) w[i] = r() < 0.5 ? 0 : 1;
  return w;
}

const HEADER_SLOTS = HEADER_BITS * CONFIG.embed.headerRepeat;

// ---- body framing: Reed-Solomon blocks ----

function blockSizes(len: number): number[] {
  const n = Math.max(1, Math.ceil(len / CONFIG.embed.rsMaxData));
  const base = Math.floor(len / n);
  const extra = len % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

const parity = (d: number) => parityFor(d, CONFIG.embed.rsParityMin, CONFIG.embed.rsParityMax, CONFIG.embed.rsParityRatio);

/** Bytes on the wire for a body of `len` bytes. */
export function codedLength(len: number): number {
  return blockSizes(len).reduce((s, d) => s + d + parity(d), 0);
}

function encodeBody(body: Uint8Array): Uint8Array {
  const out = new Uint8Array(codedLength(body.length));
  let pos = 0;
  let off = 0;
  for (const d of blockSizes(body.length)) {
    const cw = rsEncode(body.subarray(off, off + d), parity(d));
    out.set(cw, pos);
    pos += cw.length;
    off += d;
  }
  return out;
}

function decodeBody(coded: Uint8Array, len: number): Uint8Array | null {
  const out = new Uint8Array(len);
  let pos = 0;
  let off = 0;
  for (const d of blockSizes(len)) {
    const n = d + parity(d);
    const data = rsDecode(coded.subarray(pos, pos + n), parity(d));
    if (!data) return null;
    out.set(data, off);
    pos += n;
    off += d;
  }
  return out;
}

// ---- capacity ----

export interface Capacity {
  blocksX: number;
  blocksY: number;
  slots: number;
  /** Largest body (bytes, after framing but before Reed-Solomon) that still gets minBodyRepeat repeats per bit. */
  maxBodyBytes: number;
}

export function capacityOf(width: number, height: number): Capacity {
  const blocksX = Math.floor(width / 8);
  const blocksY = Math.floor(height / 8);
  const slots = blocksX * blocksY * K;
  const bodySlots = Math.max(0, slots - HEADER_SLOTS);
  let max = 0;
  // codedLength is monotonic; walk up in coarse steps then refine
  for (let len = 1; len <= 0xffff; len += 1) {
    if (codedLength(len) * 8 * CONFIG.embed.minBodyRepeat > bodySlots) break;
    max = len;
    if (len > 4096) break;
  }
  return { blocksX, blocksY, slots, maxBodyBytes: max };
}

export function repeatFor(width: number, height: number, bodyLen: number): number {
  const bodySlots = Math.max(0, Math.floor(width / 8) * Math.floor(height / 8) * K - HEADER_SLOTS);
  return Math.floor(bodySlots / (codedLength(bodyLen) * 8));
}

// ---- embedding ----

function toBits(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) for (let j = 0; j < 8; j++) bits[i * 8 + j] = (bytes[i] >> (7 - j)) & 1;
  return bits;
}

function toBytes(bits: Uint8Array): Uint8Array {
  const out = new Uint8Array(bits.length >> 3);
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j];
    out[i] = v;
  }
  return out;
}

function headerBytes(flags: number, length: number): Uint8Array {
  const b0 = ((FORMAT_VERSION & 0x0f) << 4) | (flags & 0x0f);
  const hi = (length >> 8) & 0xff;
  const lo = length & 0xff;
  return rsEncode(Uint8Array.of(b0, hi, lo, b0 ^ hi ^ lo ^ 0xa5), HEADER_PARITY);
}

export class CapacityError extends Error {}

/**
 * Writes `body` into the raster in place. The raster must be a whole number of blocks (use cropToBlocks first).
 * `step` is the QIM step: larger survives harder recompression and shows more.
 */
export function embed(img: Raster, flags: number, body: Uint8Array, step: number): void {
  if (img.width % 8 || img.height % 8) throw new Error("raster must be a multiple of 8");
  if (body.length < 1 || body.length > 0xffff) throw new CapacityError("body length out of range");
  const lay = layoutFor(img.width / 8, img.height / 8);
  const R = repeatFor(img.width, img.height, body.length);
  if (R < CONFIG.embed.minBodyRepeat) throw new CapacityError("message does not fit this image");

  const coded = encodeBody(body);
  const hdr = headerBytes(flags, body.length);
  const wh = whitening(HEADER_BITS + coded.length * 8);
  const hBits = toBits(hdr);
  const bBits = toBits(coded);

  // bit assigned to every slot (-1 = untouched)
  const slotBit = new Int8Array(lay.slots).fill(-1);
  for (let t = 0; t < HEADER_SLOTS; t++) {
    const j = t % HEADER_BITS;
    slotBit[lay.order[t]] = hBits[j] ^ wh[j];
  }
  const nb = bBits.length;
  for (let t = 0; t < R * nb; t++) {
    const j = t % nb;
    slotBit[lay.order[HEADER_SLOTS + t]] = bBits[j] ^ wh[HEADER_BITS + j];
  }

  const y = luma(img);
  const stride = img.width;
  const delta = new Float32Array(y.length);
  for (let by = 0; by < lay.blocksY; by++) {
    for (let bx = 0; bx < lay.blocksX; bx++) {
      const blockIndex = by * lay.blocksX + bx;
      for (let k = 0; k < K; k++) {
        const slot = blockIndex * K + k;
        const bit = slotBit[slot];
        if (bit < 0) continue;
        const c = coefficient(y, stride, bx, by, k);
        const d = lay.dither[slot] * step;
        const off = d + (bit * step) / 2;
        const target = Math.round((c - off) / step) * step + off;
        const dc = target - c;
        const b = basis[k];
        const base = by * 8 * stride + bx * 8;
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) delta[base + yy * stride + xx] += dc * b[yy * 8 + xx];
      }
    }
  }
  const px = img.data;
  for (let i = 0, p = 0; i < delta.length; i++, p += 4) {
    const dv = delta[i];
    if (dv === 0) continue;
    px[p] = Math.round(px[p] + dv);
    px[p + 1] = Math.round(px[p + 1] + dv);
    px[p + 2] = Math.round(px[p + 2] + dv);
  }
}

// ---- extraction ----

export type Extraction =
  | { status: "ok"; flags: number; body: Uint8Array; step: number }
  | { status: "none" }
  | { status: "corrupt" }
  | { status: "version" };

/** Signed vote for one coefficient: positive means "bit 1". */
function vote(c: number, dither: number, step: number): number {
  const off = dither * step;
  const a = (c - off) / step;
  const d0 = Math.abs(a - Math.round(a));
  const b = (c - off - step / 2) / step;
  const d1 = Math.abs(b - Math.round(b));
  return d0 - d1;
}

function coefficientAt(y: Float32Array, stride: number, lay: Layout, slot: number): number {
  const blockIndex = Math.floor(slot / K);
  const k = slot - blockIndex * K;
  const bx = blockIndex % lay.blocksX;
  const by = Math.floor(blockIndex / lay.blocksX);
  return coefficient(y, stride, bx, by, k);
}

function decideBits(votes: Float64Array, white: Uint8Array, whiteOffset: number): Uint8Array {
  const bits = new Uint8Array(votes.length);
  for (let j = 0; j < votes.length; j++) bits[j] = (votes[j] > 0 ? 1 : 0) ^ white[whiteOffset + j];
  return bits;
}

/** Tries to read a message from the raster as it stands (no resizing). The raster may be any size; whole blocks are used. */
export function extract(img: Raster): Extraction {
  const w8 = img.width - (img.width % 8);
  const h8 = img.height - (img.height % 8);
  if (w8 < 64 || h8 < 64) return { status: "none" };
  // blocks are counted over whole 8x8 cells of the top-left grid
  const lay = layoutFor(w8 / 8, h8 / 8);
  if (lay.slots <= HEADER_SLOTS) return { status: "none" };
  const y = luma(img);
  const stride = img.width;

  const hc = new Float32Array(HEADER_SLOTS);
  for (let t = 0; t < HEADER_SLOTS; t++) hc[t] = coefficientAt(y, stride, lay, lay.order[t]);
  const headerWhite = whitening(HEADER_BITS);

  for (const step of CONFIG.embed.steps) {
    const votes = new Float64Array(HEADER_BITS);
    for (let t = 0; t < HEADER_SLOTS; t++) votes[t % HEADER_BITS] += vote(hc[t], lay.dither[lay.order[t]], step);
    const hdr = rsDecode(toBytes(decideBits(votes, headerWhite, 0)), HEADER_PARITY);
    if (!hdr) continue;
    const [b0, hi, lo, chk] = hdr;
    if (chk !== (b0 ^ hi ^ lo ^ 0xa5)) continue;
    if (b0 >> 4 !== FORMAT_VERSION) return { status: "version" }; // a valid header from another format version
    const length = (hi << 8) | lo;
    if (length < 1) continue;
    const flags = b0 & 0x0f;

    // The header is now known exactly, so measure how trustworthy each coefficient position was and weight body votes by it.
    const truth = toBits(headerBytes(flags, length));
    const wrong = new Float64Array(K);
    const seen = new Float64Array(K);
    for (let t = 0; t < HEADER_SLOTS; t++) {
      const k = lay.order[t] % K;
      const bit = truth[t % HEADER_BITS] ^ headerWhite[t % HEADER_BITS];
      seen[k]++;
      if ((vote(hc[t], lay.dither[lay.order[t]], step) > 0 ? 1 : 0) !== bit) wrong[k]++;
    }
    const weight = Array.from(seen, (n, k) => {
      const e = Math.min(0.45, Math.max(0.01, wrong[k] / Math.max(1, n)));
      return Math.log((1 - e) / e);
    });

    const R = repeatFor(w8, h8, length);
    if (R < 1) return { status: "corrupt" };
    const nb = codedLength(length) * 8;
    const bv = new Float64Array(nb);
    for (let t = 0; t < R * nb; t++) {
      const slot = lay.order[HEADER_SLOTS + t];
      bv[t % nb] += weight[slot % K] * vote(coefficientAt(y, stride, lay, slot), lay.dither[slot], step);
    }
    const body = decodeBody(toBytes(decideBits(bv, whitening(HEADER_BITS + nb), HEADER_BITS)), length);
    return body ? { status: "ok", flags, body, step } : { status: "corrupt" };
  }
  return { status: "none" };
}
