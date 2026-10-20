/** Baseline for the comparison in docs/algorithm-evaluation.md: plain least-significant-bit embedding in the pixels, with the same Reed-Solomon coding. */
import { cropToBlocks } from "../src/image/pixels";
import { recompress, synthPhoto } from "../tests/fixtures/synth";
import { rsDecode, rsEncode } from "../src/payload/reed-solomon";
import { shuffledIndices } from "../src/image/prng";

const img = cropToBlocks(synthPhoto(1280, 960, "lsb"));
const msg = Uint8Array.from({ length: 100 }, (_, i) => (i * 7 + 1) & 255);
const nsym = 64;
const coded = [...rsEncode(msg.subarray(0, 100), nsym)];
const bits = coded.flatMap((b) => Array.from({ length: 8 }, (_, j) => (b >> (7 - j)) & 1));
const order = shuffledIndices(img.width * img.height, "lsb");
const R = Math.floor((img.width * img.height) / bits.length);
for (let t = 0; t < R * bits.length; t++) {
  const p = order[t] * 4 + 2; // blue channel
  img.data[p] = (img.data[p] & 0xfe) | bits[t % bits.length];
}
function read(r: typeof img): boolean {
  const votes = new Array(bits.length).fill(0);
  for (let t = 0; t < R * bits.length; t++) votes[t % bits.length] += (r.data[order[t] * 4 + 2] & 1) ? 1 : -1;
  const out = new Uint8Array(coded.length);
  for (let i = 0; i < out.length; i++) for (let j = 0; j < 8; j++) out[i] = (out[i] << 1) | (votes[i * 8 + j] > 0 ? 1 : 0);
  const d = rsDecode(out, nsym);
  return !!d && d.every((v, i) => v === msg[i]);
}
console.log("jpegQ,recovered");
console.log("lossless," + read(img));
for (const q of [100, 95, 92, 80, 60]) console.log(`${q},${read(await recompress(img, q))}`);
