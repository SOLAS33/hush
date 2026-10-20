import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CapacityError, decode, encode, prepare } from "../../src/image/engine";
import { recompress, synthPhoto } from "../fixtures/synth";
import { nodeCodec } from "../fixtures/node-codec";
import { psnr } from "../../src/image/pixels";
import { embed } from "../../src/image/embed-core";

const body = (n: number, salt = 3) => Uint8Array.from({ length: n }, (_, i) => (i * 29 + salt) & 255);
async function toRaster(jpg: Uint8Array) {
  const o = await sharp(jpg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(o.data.buffer, o.data.byteOffset, o.data.byteLength), width: o.info.width, height: o.info.height };
}

describe("engine: encode with self-test, then decode after a simulated messenger", () => {
  it("recovers 240 bytes exactly after JPEG recompression at several qualities", async () => {
    const base = prepare(synthPhoto(1600, 1200, "e1"));
    expect(base.width).toBe(1280);
    const msg = body(240);
    const enc = await encode(base, 0, msg, nodeCodec);
    expect(enc.verified).toBe(true);
    const shared = await toRaster(enc.jpeg);
    for (const q of [90, 75, 60, 50]) {
      const r = decode(await recompress(shared, q));
      expect(r.status, `q${q}`).toBe("ok");
      if (r.status === "ok") expect(Array.from(r.body)).toEqual(Array.from(msg));
    }
  });

  it("recovers after the messenger also shrinks the picture", async () => {
    const base = prepare(synthPhoto(1280, 960, "e2"));
    const msg = body(120, 9);
    const enc = await encode(base, 1, msg, nodeCodec);
    const shared = await toRaster(enc.jpeg);
    for (const w of [1152, 1024]) {
      const r = decode(await recompress(shared, 70, w));
      expect(r.status, `${w}px`).toBe("ok");
      if (r.status === "ok") {
        expect(r.flags).toBe(1);
        expect(Array.from(r.body)).toEqual(Array.from(msg));
      }
    }
  });

  it("the strongest step also survives a heavy shrink (800px) when asked for explicitly", async () => {
    const base = prepare(synthPhoto(1280, 960, "e2b"));
    const msg = body(100, 4);
    embed(base, 0, msg, 52);
    const r = decode(await recompress(base, 70, 800));
    expect(r.status).toBe("ok");
  });

  it("works on a portrait image", async () => {
    const base = prepare(synthPhoto(960, 1280, "e3"));
    const msg = body(80, 5);
    const enc = await encode(base, 0, msg, nodeCodec);
    const r = decode(await recompress(await toRaster(enc.jpeg), 65));
    expect(r.status).toBe("ok");
  });

  it("finds nothing in an ordinary photograph", async () => {
    const plain = prepare(synthPhoto(1280, 960, "plain"));
    expect(decode(plain).status).toBe("none");
    expect(decode(await recompress(plain, 70)).status).toBe("none");
  });

  it("refuses a message that cannot fit", async () => {
    const small = prepare(synthPhoto(640, 480, "tiny"));
    await expect(encode(small, 0, body(900), nodeCodec)).rejects.toBeInstanceOf(CapacityError);
  });

  it("keeps the picture close to the original", async () => {
    const base = prepare(synthPhoto(1280, 960, "q"));
    const enc = await encode(base, 0, body(240), nodeCodec);
    expect(psnr(base, await toRaster(enc.jpeg))).toBeGreaterThan(33);
  });
});
