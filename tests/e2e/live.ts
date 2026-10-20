/**
 * Live end-to-end test: the path a real person takes, on the real sites.
 *   node --import tsx tests/e2e/live.ts
 * solas33.com products page -> Hush card and install guide -> Open Hush -> hush.solas33.com (headers, manifest, icons, service worker, installable)
 * -> hide a message -> share sheet (mocked, the one thing a desktop cannot do) -> messenger recompress -> reveal the exact message.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { launch, out, reporter } from "./lib";

mkdirSync(out, { recursive: true });
const { check, done } = reporter();
const SOLAS = process.env.SOLAS33_URL ?? "https://solas33.com";
const HUSH = process.env.HUSH_URL ?? "https://hush.solas33.com";

const photoBuf = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: "gaussian", mean: 128, sigma: 40 } } }).blur(1.6).jpeg({ quality: 92 }).toBuffer();
const photo = join(out, "live-photo.jpg");
writeFileSync(photo, photoBuf);

// ---- 0. what the servers say, before any browser ----
const get = async (u: string) => fetch(u, { redirect: "manual" });
{
  const r = await get(`${SOLAS}/products`);
  const html = await r.text();
  check(r.status === 200 && html.includes('data-id="hush"') && html.includes("Hush: messages hidden in photos"), "products page (no JavaScript) lists Hush");
  check(html.includes("Install on iPhone or iPad") && html.includes("Install on Android") && html.includes("Add to Home Screen"), "products page (no JavaScript) carries the install guide");
  const entry = html.match(/<article[^>]*data-id="hush"[\s\S]*?<\/article>/)?.[0] ?? "";
  check(entry.length > 2000 && !/prototype/i.test(entry), "Hush's product entry has no 'prototype' wording");
  const img = await get(`${SOLAS}/images/products/hush-960.webp`);
  check(img.status === 200 && (img.headers.get("content-type") ?? "").includes("webp"), "product screenshot is served");
  const ico = await get(`${SOLAS}/images/products/hush-icon.svg`);
  check(ico.status === 200, "product icon is served");
}
{
  const r = await get(`${HUSH}/`);
  const h = (k: string) => r.headers.get(k) ?? "";
  check(r.status === 200, "hush.solas33.com answers over HTTPS");
  check(h("content-security-policy").includes("default-src 'none'") && !h("content-security-policy").includes("unsafe-inline") && h("referrer-policy") === "no-referrer" && h("x-content-type-options") === "nosniff", "security headers are in place (strict CSP, no referrer, nosniff)");
  const m = await (await get(`${HUSH}/manifest.webmanifest`)).json();
  check(m.name === "Hush" && m.display === "standalone" && m.start_url === "/" && m.share_target?.action === "/share-target", "manifest is served and correct");
  for (const i of m.icons) check((await get(`${HUSH}${i.src}`)).status === 200, `icon ${i.src} is served`);
  check((await get(`${HUSH}/icons/apple-touch-icon.png`)).status === 200, "iPhone home-screen icon is served");
  const sw = await (await get(`${HUSH}/sw.js`)).text();
  check(sw.includes("hush-shell-") && !sw.includes("/*PRECACHE*/") && !sw.includes("__VERSION__"), "service worker has its file list and version filled in");
  check(!/prototype/i.test(await (await get(`${HUSH}/`)).text()), "page source has no 'prototype' wording");
}

const browser = await launch();
const logs: string[] = [];
const failedRequests: string[] = [];
const MOCK = `window.__name = window.__name || function (f) { return f; };
  window.__shared = [];
  Object.defineProperty(navigator, "canShare", { value: function (d) { return !!(d && d.files && d.files.length); }, configurable: true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async function (d) { var f = d.files[0]; window.__shared.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) }); } });`;
async function newPage(mock = false) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on("console", (m: any) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e: unknown) => logs.push(`pageerror: ${e}`));
  page.on("response", (r: any) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) failedRequests.push(`${r.status()} ${r.url()}`); });
  if (mock) await page.evaluateOnNewDocument(MOCK);
  return page;
}
const text = (p: any) => p.evaluate(() => document.body.innerText) as Promise<string>;
const waitText = (p: any, s: string, ms = 90_000) => p.waitForFunction((t: string) => document.body.innerText.includes(t), { timeout: ms }, s);

// ---- 1. the Solas33 products page, as a person sees it ----
{
  const page = await newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${SOLAS}/products?product=hush`, { waitUntil: "networkidle0" });
  await waitText(page, "Hush: messages hidden in photos", 20_000);
  const t = await text(page);
  check(t.includes("Get Hush on your phone") && t.includes("Install on iPhone or iPad"), "the Hush product panel shows the install guide");
  check(t.includes("Live.") && t.includes("Free to use, no account"), "status says Live and Free");
  await page.evaluate(() => document.querySelectorAll(".guide-sec").forEach((d: any) => (d.open = true)));
  const steps = await page.evaluate(() => Array.from(document.querySelectorAll(".guide-steps li")).length);
  check(steps >= 18, `all install and usage steps are on the page (${steps} numbered steps)`);
  const href = await page.evaluate(() => (Array.from(document.querySelectorAll("a.btn")).find((a: any) => a.textContent?.includes("Open Hush")) as HTMLAnchorElement | undefined)?.href ?? "");
  check(href.replace(/\/$/, "") === HUSH, `the Open Hush button points at ${HUSH}`);
  await page.screenshot({ path: join(out, "live-products.png") });
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.evaluate(() => (Array.from(document.querySelectorAll("a.btn")).find((a: any) => a.textContent?.includes("Open Hush")) as HTMLAnchorElement).click())]);
  check(page.url().startsWith(HUSH), "clicking Open Hush lands on the Hush app");
  await page.close();
}

// ---- 2. the app, on the real domain ----
const verifyApp = await newPage();
await verifyApp.goto(HUSH, { waitUntil: "networkidle0" });
{
  const t = await text(verifyApp);
  check(t.includes("Hide a message in a photo.") && t.includes("How to use Hush") && t.includes("Get the app"), "home screen shows the steps and the install help");
  const client = await verifyApp.createCDPSession();
  const res: any = await client.send("Page.getInstallabilityErrors");
  check(res.installabilityErrors.length === 0, `Chrome reports Hush installable on the real domain${res.installabilityErrors.length ? " " + JSON.stringify(res.installabilityErrors) : ""}`);
  check(await verifyApp.evaluate(async () => !!(await navigator.serviceWorker.ready).active), "service worker active on the real domain");
  await verifyApp.screenshot({ path: join(out, "live-home.png") });
}
await verifyApp.close();

const MESSAGE = "Live check: meet at the usual place at 9.\nBring the blue folder.";
let shared: number[] = [];
{
  const page = await newPage(true);
  await page.goto(HUSH, { waitUntil: "networkidle0" });
  await page.click("text/Create message");
  await page.waitForSelector("label.btn.file");
  await (await page.$$("label.btn.file input"))[1].uploadFile(photo);
  await page.waitForSelector("textarea", { timeout: 60_000 });
  await page.type("textarea", MESSAGE);
  await page.click("text/Hide message");
  await waitText(page, "Ready to send", 150_000);
  check((await text(page)).includes("Tested on this phone"), "live app hid the message and the photo passed its own compression test");
  await page.click("text/Share image");
  await waitText(page, "Shared. In WhatsApp");
  const s = await page.evaluate(() => (window as any).__shared);
  shared = s[0].bytes;
  check(s.length === 1 && s[0].type === "image/jpeg", "share sheet received the JPEG");
  await page.close();
}
for (const q of [75, 60]) {
  const f = join(out, `live-wa${q}.jpg`);
  await sharp(Buffer.from(shared)).jpeg({ quality: q, chromaSubsampling: "4:2:0" }).toFile(f);
  const page = await newPage();
  await page.goto(HUSH, { waitUntil: "networkidle0" });
  await page.click("text/Reveal message");
  await page.waitForSelector("label.btn.file input");
  await (await page.$("label.btn.file input")).uploadFile(f);
  await page.waitForFunction(() => !!document.querySelector(".message") || !!document.querySelector(".error"), { timeout: 60_000 });
  const got = await page.evaluate(() => (document.querySelector(".message") as HTMLElement | null)?.innerText ?? "ERROR");
  check(got === MESSAGE, `live app revealed the exact message after a messenger recompress at JPEG ${q}`);
  if (q === 75) {
    await page.screenshot({ path: join(out, "live-reveal.png") });
    await page.click("text/Done");
    await waitText(page, "Hide a message in a photo");
    check(!(await text(page)).includes("Live check"), "Done clears the message");
  }
  await page.close();
}

const leak = logs.filter((l) => /Live check|usual place|blue folder/.test(l));
check(leak.length === 0, "no message text in the console");
const bad = [...logs.filter((l) => /^(pageerror)/.test(l) || /Content Security Policy/i.test(l)), ...failedRequests];
check(bad.length === 0, `no script errors, CSP violations or failed requests on the live sites (the Solas33 site has no favicon.ico; that is not Hush)${bad.length ? ": " + bad.slice(0, 3).join(" | ") : ""}`);

await browser.close();
done();
