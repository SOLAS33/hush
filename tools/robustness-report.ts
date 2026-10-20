/** Algorithm-selection harness (brief 5.2): recovery rate, image quality and timing across JPEG qualities and step sizes. `npm run report` */
import { embed, extract } from "../src/image/embed-core";
import { cropToBlocks, psnr, ssim } from "../src/image/pixels";
import { recompress, synthPhoto } from "../tests/fixtures/synth";
import { CONFIG } from "../src/config";

const sizes: Array<[number, number]> = [[1280, 960], [1024, 768], [800, 600]];
const qualities = [92, 80, 70, 60, 50, 40, 30];
const lens = [60, 240, 400];

console.log("size,len,step,psnr,ssim,jpegQ,recovered,ms");
for (const [w, h] of sizes) {
  const base = cropToBlocks(synthPhoto(w, h, `s${w}`));
  for (const len of lens) {
    const body = Uint8Array.from({ length: len }, (_, i) => (i * 31 + 7) & 255);
    for (const step of CONFIG.embed.steps) {
      const img = { data: Uint8ClampedArray.from(base.data), width: base.width, height: base.height };
      embed(img, 0, body, step);
      const q = [psnr(base, img).toFixed(1), ssim(base, img).toFixed(4)];
      for (const jq of qualities) {
        const t0 = Date.now();
        const rx = await recompress(img, jq);
        const r = extract(rx);
        const ok = r.status === "ok" && r.body.length === body.length && r.body.every((v, i) => v === body[i]);
        console.log(`${w}x${h},${len},${step},${q[0]},${q[1]},${jq},${ok ? "yes" : r.status},${Date.now() - t0}`);
      }
    }
  }
}
