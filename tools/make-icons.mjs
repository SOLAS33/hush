// Draws the Hush icon (three quieting lines) and writes the PNG sizes the manifest needs. Run: node tools/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2040"/><stop offset="1" stop-color="#0f1220"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)" ${pad ? "" : 'rx="112"'}/>
  <g fill="#f4f1ea" transform="translate(256 256) scale(${pad ? 0.78 : 1}) translate(-256 -256)">
    <rect x="116" y="150" width="280" height="40" rx="20"/>
    <rect x="116" y="236" width="200" height="40" rx="20" opacity=".6"/>
    <rect x="116" y="322" width="110" height="40" rx="20" opacity=".3"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
for (const [name, size, pad] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["icon-maskable-512.png", 512, true]]) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
await sharp(Buffer.from(svg(false))).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(Buffer.from(svg(false))).resize(48, 48).png().toFile("public/icons/favicon.png");
console.log("icons written");
