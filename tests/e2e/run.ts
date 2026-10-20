/**
 * End-to-end test in a real Chrome: the actual built app, served with its real security headers.
 *   npm run build && npm run test:e2e        (CHROME_PATH can point at any Chrome or Chromium)
 * Flow: pick a photo -> hide a message in the app -> take the file the app produced -> recompress it like a messenger would
 * -> open that file in a fresh page via "Reveal" -> the exact message must appear. Then the privacy checks.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { synthPhoto } from "../fixtures/synth";

const dist = join(import.meta.dirname, "..", "..", "dist");
const out = join(import.meta.dirname, "out");
mkdirSync(out, { recursive: true });

// ---- serve dist with the headers from public/_headers ----
const headerRules: Array<{ path: string; headers: Record<string, string> }> = [];
{
  let cur: { path: string; headers: Record<string, string> } | null = null;
  for (const line of readFileSync(join(dist, "_headers"), "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ")) headerRules.push((cur = { path: line.trim(), headers: {} }));
    else if (cur) {
      const i = line.indexOf(":");
      cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
}
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = new URL(req.url!, "http://x").pathname;
  let file = join(dist, p === "/" ? "index.html" : p);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
  const h: Record<string, string> = { "Content-Type": types[extname(file)] ?? "application/octet-stream" };
  for (const r of headerRules) {
    const match = r.path === "/*" || r.path === p || (r.path.endsWith("/*") && p.startsWith(r.path.slice(0, -1)));
    if (match) Object.assign(h, r.headers);
  }
  // Test only: let the test read the produced blob back. The shipped policy has no blob: in connect-src.
  if (h["Content-Security-Policy"]) h["Content-Security-Policy"] = h["Content-Security-Policy"].replace("connect-src 'self'", "connect-src 'self' blob:");
  res.writeHead(200, h).end(readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

// ---- test material ----
const photo = synthPhoto(2400, 1800, "e2e");
const photoPath = join(out, "source.jpg");
await sharp(Buffer.from(photo.data.buffer), { raw: { width: photo.width, height: photo.height, channels: 4 } }).removeAlpha().jpeg({ quality: 95 }).toFile(photoPath);

const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!chrome) throw new Error("No Chrome found. Set CHROME_PATH.");
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

const logs: string[] = [];
async function newPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  page.on("console", (m: any) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e: unknown) => logs.push(`pageerror: ${e}`));
  return page;
}

async function create(message: string, passcode?: string): Promise<{ file: string; verified: boolean }> {
  const page = await newPage();
  await page.goto(base);
  const [chooser] = await Promise.all([page.waitForFileChooser(), page.click("text/Create message").then(() => page.waitForSelector("label.btn.file")).then(() => page.evaluate(() => (document.querySelectorAll("label.btn.file input")[1] as HTMLInputElement).click()))]);
  await chooser.accept([photoPath]);
  await page.waitForSelector("textarea");
  await page.type("textarea", message);
  if (passcode) {
    await page.click("input[type=checkbox]");
    const inputs = await page.$$("input[type=password]");
    await inputs[0].type(passcode);
    await inputs[1].type(passcode);
  }
  await page.click("text/Hide message");
  await page.waitForFunction(() => document.body.innerText.includes("Ready to send"), { timeout: 120_000 });
  const verified = await page.evaluate(() => document.body.innerText.includes("Tested on this phone"));
  const bytes: number[] = await page.evaluate(async () => {
    const img = document.querySelector("img.shot") as HTMLImageElement;
    return Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer()));
  });
  const file = join(out, passcode ? "hidden-locked.jpg" : "hidden.jpg");
  writeFileSync(file, Buffer.from(bytes));
  // privacy: nothing about the message or photo in browser storage
  const stores = await page.evaluate(async () => ({
    ls: Object.keys(localStorage).length,
    ss: Object.keys(sessionStorage).length,
    idb: ((await indexedDB.databases?.()) ?? []).length,
    caches: await caches.keys(),
  }));
  check(stores.ls === 0 && stores.ss === 0 && stores.idb === 0, "no localStorage, sessionStorage or IndexedDB entries after creating");
  check(!stores.caches.some((k: string) => /image|photo|result/i.test(k)), "no photo caches");
  await page.close();
  return { file, verified };
}

async function reveal(file: string, passcode?: string): Promise<string> {
  const page = await newPage();
  await page.goto(base);
  await page.click("text/Reveal message");
  await page.waitForSelector("label.btn.file input");
  const input = await page.$("label.btn.file input");
  await input!.uploadFile(file);
  if (passcode) {
    await page.waitForSelector("input[type=password]", { timeout: 60_000 });
    await page.type("input[type=password]", passcode);
    await page.click("text/Unlock");
  }
  await page.waitForFunction(() => !!document.querySelector(".message") || !!document.querySelector(".error"), { timeout: 60_000 });
  const text = await page.evaluate(() => (document.querySelector(".message") as HTMLElement | null)?.innerText ?? `ERROR: ${(document.querySelector(".error") as HTMLElement).innerText}`);
  if (!text.startsWith("ERROR")) {
    await page.click("text/Done");
    await page.waitForFunction(() => document.body.innerText.includes("Hide a message in a photo"));
    check(await page.evaluate(() => !document.body.innerText.includes("the usual")), "after Done the message is gone from the page");
  }
  await page.close();
  return text;
}

async function messenger(file: string, quality: number, width?: number): Promise<string> {
  const dest = file.replace(".jpg", `-wa${quality}${width ? "-" + width : ""}.jpg`);
  let s = sharp(file);
  if (width) s = s.resize({ width });
  await s.jpeg({ quality, chromaSubsampling: "4:2:0" }).toFile(dest);
  return dest;
}

const MESSAGE = "Meet at the usual place at 9.\nBring the blue folder \u2013 caf\u00e9 side.";
const created = await create(MESSAGE);
check(created.verified, "app reports the photo passed its own compression self-test");
for (const q of [80, 65, 50]) {
  const got = await reveal(await messenger(created.file, q));
  check(got === MESSAGE, `plain message recovered exactly after a messenger recompress at JPEG ${q}`);
}
check((await reveal(created.file)) === MESSAGE, "plain message recovered from the shared file itself");

const lockedMsg = "The code is 4471.";
const locked = await create(lockedMsg, "three blue herons");
check(locked.verified, "locked photo passed its self-test");
check((await reveal(await messenger(locked.file, 65), "three blue herons")) === lockedMsg, "locked message recovered with the right passcode after recompress");
check((await reveal(await messenger(locked.file, 65), "three red herons!!")).startsWith("ERROR: Unable to unlock message"), "wrong passcode gives the generic failure");

const plain = join(out, "source.jpg");
check((await reveal(plain)).startsWith("ERROR: No supported hidden message found"), "an ordinary photo reports no message");

const leak = logs.filter((l) => /usual place|blue folder|herons|4471/.test(l));
check(leak.length === 0, "no message text or passcode in the console");
const bad = logs.filter((l) => /^(error|pageerror)/.test(l) || /Content Security Policy/i.test(l));
check(bad.length === 0, `no console errors or CSP violations${bad.length ? ": " + bad.slice(0, 3).join(" | ") : ""}`);

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
