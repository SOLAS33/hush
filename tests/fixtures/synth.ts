import sharp from "sharp";
import type { Raster } from "../../src/image/pixels";
import { rng } from "../../src/image/prng";

/** A photograph-like test image: layered value noise (several octaves), soft gradients and a few edges. Deterministic. */
export function synthPhoto(w: number, h: number, seed = "photo"): Raster {
  const r = rng(seed);
  const data = new Uint8ClampedArray(w * h * 4);
  const octaves = [64, 32, 16, 8, 4, 2];
  const grids = octaves.map((cell) => {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
    const g = new Float32Array(gw * gh * 3);
    for (let i = 0; i < g.length; i++) g[i] = r() - 0.5;
    return { cell, gw, g };
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = 110 + 50 * Math.sin((x / w) * 3 + c) + 40 * (y / h);
        grids.forEach(({ cell, gw, g }, o) => {
          const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = fx - x0, ty = fy - y0;
          const a = g[(y0 * gw + x0) * 3 + c], b = g[(y0 * gw + x0 + 1) * 3 + c], d = g[((y0 + 1) * gw + x0) * 3 + c], e = g[((y0 + 1) * gw + x0 + 1) * 3 + c];
          v += (a * (1 - tx) + b * tx) * (1 - ty) * (90 / (o + 1.2)) + (d * (1 - tx) + e * tx) * ty * (90 / (o + 1.2));
        });
        if (((x - w / 2) ** 2 + (y - h / 2) ** 2) < (h / 5) ** 2) v += 35; // a disc, so there is a hard edge
        data[p + c] = v;
      }
      data[p + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

/** What a messenger does: JPEG at some quality (optionally resized first), then we read the pixels back. */
export async function recompress(img: Raster, quality: number, resizeTo?: number): Promise<Raster> {
  let s = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } }).removeAlpha();
  if (resizeTo) s = s.resize({ width: resizeTo, kernel: "lanczos3" });
  const jpg = await s.jpeg({ quality, chromaSubsampling: "4:2:0" }).toBuffer();
  const out = await sharp(jpg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(out.data.buffer, out.data.byteOffset, out.data.byteLength), width: out.info.width, height: out.info.height };
}
