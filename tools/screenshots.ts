/**
 * Makes the product-page image: three phone screens of the built app on one 1600x1000 canvas.
 * Needs `npm run build` and `npm run test:e2e` first (it reuses the photo and the hidden-message file the e2e test leaves in tests/e2e/out).
 *   node --import tsx tools/screenshots.ts <output folder>
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const out = process.argv[2] ?? join(root, "tests", "e2e", "out");
mkdirSync(out, { recursive: true });
const hidden = join(root, "tests", "e2e", "out", "hidden-wa65.jpg");

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = new URL(req.url!, "http://x").pathname;
  let f = join(dist, p === "/" ? "index.html" : p);
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, "index.html");
  res.writeHead(200, { "Content-Type": types[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
async function page() {
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 780, deviceScaleFactor: 2 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  return p;
}
const shots: Buffer[] = [];

{
  const p = await page();
  await p.goto(base);
  await p.waitForSelector("h1");
  shots.push(Buffer.from(await p.screenshot()));
  await p.close();
}
{
  const p = await page();
  await p.goto(base);
  await p.click("text/Guide");
  await p.waitForSelector("#install-iphone");
  await new Promise((r) => setTimeout(r, 300));
  shots.push(Buffer.from(await p.screenshot()));
  await p.close();
}
{
  const p = await page();
  await p.goto(base);
  await p.click("text/Reveal message");
  await p.waitForSelector("label.btn.file input");
  await (await p.$("label.btn.file input"))!.uploadFile(hidden);
  await p.waitForSelector(".message");
  shots.push(Buffer.from(await p.screenshot()));
  await p.close();
}
await browser.close();
server.close();

const W = 1600, H = 1000, ph = 860;
const pw = Math.round((ph * 390) / 780);
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2040"/><stop offset="1" stop-color="#0b0d19"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);
const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="38" fill="#fff"/></svg>`);
const layers = [];
const gap = 90;
const x0 = Math.round((W - (3 * pw + 2 * gap)) / 2);
for (let i = 0; i < 3; i++) {
  const img = await sharp(shots[i]).resize(pw, ph).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  layers.push({ input: img, left: x0 + i * (pw + gap), top: Math.round((H - ph) / 2) });
}
const final = await sharp(bg).composite(layers).png().toBuffer();
for (const w of [640, 960, 1600]) await sharp(final).resize(w).webp({ quality: 82 }).toFile(join(out, `hush-${w}.webp`));
console.log("wrote", out);
