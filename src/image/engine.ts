/**
 * The encode/decode pipeline, independent of the browser: it only needs a `JpegCodec` to turn pixels into a JPEG and back.
 * The app supplies a canvas codec; the tests supply a libjpeg codec (sharp). Same engine in both.
 */
import { CONFIG } from "../config";
import { CapacityError, capacityOf, embed, extract, type Extraction } from "./embed-core";
import { cropToBlocks, resize, type Raster } from "./pixels";

export interface JpegCodec {
  /** Encode to JPEG at quality 0..1, then decode again. `bytes` is the JPEG file; `decoded` is what a recipient's decoder would see. */
  roundTrip(img: Raster, quality: number): Promise<{ bytes: Uint8Array; decoded: Raster }>;
}

export class ImageTooSmallError extends Error {}

/** Scale down (never up) to the working size and trim to whole 8x8 blocks. */
export function prepare(src: Raster): Raster {
  const long = Math.max(src.width, src.height);
  if (long < CONFIG.image.minLongEdge) throw new ImageTooSmallError(`long edge ${long}px is below ${CONFIG.image.minLongEdge}px`);
  let r = src;
  if (long > CONFIG.image.maxLongEdge) {
    const s = CONFIG.image.maxLongEdge / long;
    // choose multiples of 8 directly so the later crop loses nothing
    const w = Math.max(8, Math.round((src.width * s) / 8) * 8);
    const h = Math.max(8, Math.round((src.height * s) / 8) * 8);
    r = resize(src, w, h);
  }
  return cropToBlocks(r);
}

/** How many bytes of framed body fit in this image. */
export function bodyCapacity(width: number, height: number): number {
  return capacityOf(width - (width % 8), height - (height % 8)).maxBodyBytes;
}

export interface Encoded {
  jpeg: Uint8Array;
  width: number;
  height: number;
  step: number;
  /** True when the output survived every stress test in CONFIG.selfTest. False means it did not: tell the user. */
  verified: boolean;
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

export async function encode(base: Raster, flags: number, body: Uint8Array, codec: JpegCodec, onProgress?: (note: string) => void): Promise<Encoded> {
  let last: Encoded | null = null;
  for (const step of CONFIG.embed.steps) {
    onProgress?.(`Hiding the message (strength ${CONFIG.embed.steps.indexOf(step) + 1} of ${CONFIG.embed.steps.length})`);
    const work: Raster = { data: Uint8ClampedArray.from(base.data), width: base.width, height: base.height };
    embed(work, flags, body, step); // throws CapacityError when it cannot fit
    const out = await codec.roundTrip(work, CONFIG.image.outputQuality);
    let ok = true;
    for (const q of CONFIG.selfTest.jpegQualities) {
      const stressed = await codec.roundTrip(out.decoded, q);
      const r = decode(stressed.decoded);
      if (r.status !== "ok" || r.flags !== flags || !same(r.body, body)) {
        ok = false;
        break;
      }
    }
    last = { jpeg: out.bytes, width: work.width, height: work.height, step, verified: ok };
    if (ok) return last;
  }
  return last!;
}

/** Reads a message from a received image: as it is, then rescaled back to the sizes we are likely to have encoded at. */
export function decode(img: Raster): Extraction {
  const direct = extract(img);
  if (direct.status !== "none") return direct;
  const long = Math.max(img.width, img.height);
  const portrait = img.height > img.width;
  let corrupt = false;
  for (const edge of CONFIG.embed.rescaleLongEdges) {
    if (edge === long) continue;
    const other = Math.max(8, Math.round(((portrait ? img.width / img.height : img.height / img.width) * edge) / 8) * 8);
    const w = portrait ? other : edge;
    const h = portrait ? edge : other;
    const r = extract(resize(img, w, h));
    if (r.status === "ok") return r;
    if (r.status === "corrupt") corrupt = true;
  }
  return corrupt ? { status: "corrupt" } : { status: "none" };
}

export { CapacityError };
