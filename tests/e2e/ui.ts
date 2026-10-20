/**
 * Whole-interface end-to-end test in real Chrome, against the built app with its real security headers.
 *   npm run build && node --import tsx tests/e2e/ui.ts
 * Covers: no "prototype" wording, install help per platform, the guide, installability, every create/reveal path,
 * sharing out (mocked share sheet), sharing in through the service worker, offline use, photo formats, orientation,
 * a 12 MP photo, limits, accessibility basics, layout at 320 px, and clearing on Done / Discard.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ANDROID_CHROME, IPHONE_CHROME, IPHONE_SAFARI, launch, out, reporter, serveDist } from "./lib";

mkdirSync(out, { recursive: true });
const { check, done } = reporter();
const { base, close } = await serveDist();
const browser = await launch();
const logs: string[] = [];

// ---- test photos (blurred noise reads as natural texture) ----
async function photo(name: string, w: number, h: number, fmt: "jpeg" | "png" | "webp" = "jpeg", orientation?: number) {
  let s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: "gaussian", mean: 128, sigma: 40 } } }).blur(1.6);
  const buf = await s.toFormat(fmt, fmt === "jpeg" ? { quality: 92 } : {}).toBuffer();
  const final = orientation ? await sharp(buf).withMetadata({ orientation }).jpeg({ quality: 92 }).toBuffer() : buf;
  const file = join(out, name);
  writeFileSync(file, final);
  return file;
}
const jpg = await photo("ui-photo.jpg", 1800, 1200);
const png = await photo("ui-photo.png", 1400, 1000, "png");
const webp = await photo("ui-photo.webp", 1400, 1000, "webp");
const tiny = await photo("ui-tiny.jpg", 400, 300);
const rotated = await photo("ui-rotated.jpg", 1400, 1000, "jpeg", 6); // stored landscape, displayed portrait
const big = await photo("ui-12mp.jpg", 4000, 3000);

async function newPage(opts: { ua?: string; width?: number; height?: number; mockShare?: "ok" | "cancel" | "none" } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: opts.width ?? 390, height: opts.height ?? 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (opts.ua) await page.setUserAgent(opts.ua);
  page.on("console", (m: any) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e: unknown) => logs.push(`pageerror: ${e}`));
  const mode = opts.mockShare ?? "none";
  // Plain script text on purpose: functions passed from TypeScript get helper calls injected that do not exist in the page.
  await page.evaluateOnNewDocument(`window.__name = window.__name || function (f) { return f; };
    window.__shared = [];
    (function (m) {
      if (m === "none") {
        Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
        Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
        return;
      }
      Object.defineProperty(navigator, "canShare", { value: function (d) { return !!(d && d.files && d.files.length); }, configurable: true });
      Object.defineProperty(navigator, "share", { configurable: true, value: async function (d) {
        if (m === "cancel") throw new DOMException("cancelled", "AbortError");
        var f = d.files[0];
        var buf = new Uint8Array(await f.arrayBuffer());
        window.__shared.push({ name: f.name, type: f.type, size: f.size, keys: Object.keys(d), bytes: Array.from(buf) });
      } });
    })(${JSON.stringify(mode)});`);
  return page;
}

const text = (page: any) => page.evaluate(() => document.body.innerText) as Promise<string>;
const waitText = (page: any, s: string, timeout = 90_000) => page.waitForFunction((t: string) => document.body.innerText.includes(t), { timeout }, s);

async function startCreate(page: any, file: string) {
  await page.goto(base);
  await page.click("text/Create message");
  await page.waitForSelector("label.btn.file");
  await (await page.$$("label.btn.file input"))[1].uploadFile(file);
  await page.waitForSelector("textarea", { timeout: 60_000 });
}

async function hide(page: any, message: string, passcode?: string) {
  await page.type("textarea", message);
  if (passcode) {
    await page.click("input[type=checkbox]");
    const pw = await page.$$("input[type=password]");
    await pw[0].type(passcode);
    await pw[1].type(passcode);
  }
  await page.click("text/Hide message");
  await waitText(page, "Ready to send", 150_000);
}

async function reveal(file: string, passcode?: string): Promise<string> {
  const page = await newPage();
  await page.goto(base);
  await page.click("text/Reveal message");
  await page.waitForSelector("label.btn.file input");
  await (await page.$("label.btn.file input")).uploadFile(file);
  if (passcode) {
    await page.waitForSelector("input[type=password]", { timeout: 60_000 });
    await page.type("input[type=password]", passcode);
    await page.click("text/Unlock");
  }
  await page.waitForFunction(() => !!document.querySelector(".message") || !!document.querySelector(".error"), { timeout: 60_000 });
  const t = await page.evaluate(() => (document.querySelector(".message") as HTMLElement | null)?.innerText ?? `ERROR: ${(document.querySelector(".error") as HTMLElement).innerText}`);
  await page.close();
  return t;
}

async function messenger(bytes: number[], quality: number, name: string) {
  const file = join(out, name);
  await sharp(Buffer.from(bytes)).jpeg({ quality, chromaSubsampling: "4:2:0" }).toFile(file);
  return file;
}

// ================= 1. Home: wording, steps, install help per platform =================
{
  const page = await newPage();
  await page.goto(base);
  const t = await text(page);
  check(!/prototype/i.test(t), "home screen has no 'prototype' wording");
  check(t.includes("How to use Hush") && t.includes("Create.") && t.includes("Send.") && t.includes("Reveal."), "home screen explains the steps");
  check(t.includes("Get the app"), "home screen has an install section on a plain browser");
  check(!/prototype/i.test(await page.title()) && (await page.evaluate(() => document.querySelector("meta[name=description]")!.getAttribute("content")!)).length > 20, "page title and description are set, no 'prototype'");
  await page.close();

  const ios = await newPage({ ua: IPHONE_SAFARI });
  await ios.goto(base);
  const ti = await text(ios);
  check(ti.includes("Add to Home Screen") && ti.includes("Share button") && ti.includes("Safari"), "iPhone Safari sees the iPhone install steps");
  check(!ti.includes("Install app\n"), "iPhone does not see an Android install button");
  await ios.close();

  const ic = await newPage({ ua: IPHONE_CHROME });
  await ic.goto(base);
  check((await text(ic)).includes("Open hush.solas33.com in Safari"), "Chrome on iPhone is told to use Safari");
  await ic.close();

  const an = await newPage({ ua: ANDROID_CHROME });
  await an.goto(base);
  const ta = await text(an);
  check(ta.includes("Install on Android") && ta.includes("Install app"), "Android sees the Android install steps");
  await an.close();
}

// ================= 2. Guide =================
{
  const page = await newPage();
  await page.goto(base);
  await page.click("text/Read the full guide");
  await waitText(page, "Install on iPhone or iPad");
  const t = await text(page);
  for (const h of ["Install on iPhone or iPad", "Install on Android", "Send a hidden message", "Read a hidden message", "Tips for reliable messages", "If something goes wrong"]) check(t.includes(h), `guide has the section: ${h}`);
  check(!/prototype/i.test(t), "guide has no 'prototype' wording");
  await page.click("text/Back to start");
  await waitText(page, "Hide a message in a photo");
  await page.click("text/Guide");
  await waitText(page, "Install on Android");
  check(true, "Guide opens from the top bar and from the home screen");
  await page.close();
}

// ================= 3. Installability, manifest, headers =================
{
  const page = await newPage();
  await page.goto(base, { waitUntil: "networkidle0" });
  const client = await page.createCDPSession();
  const res: any = await client.send("Page.getInstallabilityErrors");
  check(res.installabilityErrors.length === 0, `browser reports the app is installable${res.installabilityErrors.length ? ": " + JSON.stringify(res.installabilityErrors) : ""}`);
  const m = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
  check(m.display === "standalone" && m.icons.some((i: any) => i.purpose === "maskable") && m.share_target?.method === "POST", "manifest: standalone, maskable icon, POST share target");
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  check(reg, "service worker is active");
  await page.close();
}

// ================= 4. Create: photo formats, orientation, big photo, limits =================
const hiddenFiles: Record<string, number[]> = {};
for (const [label, file] of [["JPEG", jpg], ["PNG", png], ["WebP", webp]] as const) {
  const page = await newPage({ mockShare: "ok" });
  await startCreate(page, file);
  await hide(page, `Hello via ${label}`);
  check((await text(page)).includes("Tested on this phone"), `${label} photo hidden and passed the self-test`);
  hiddenFiles[label] = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch((document.querySelector("img.shot") as HTMLImageElement).src)).arrayBuffer())));
  await page.close();
}
for (const label of Object.keys(hiddenFiles)) {
  const f = await messenger(hiddenFiles[label], 65, `ui-${label}-wa65.jpg`);
  check((await reveal(f)) === `Hello via ${label}`, `${label}: message recovered after a messenger recompress`);
}

{
  const page = await newPage();
  await startCreate(page, rotated);
  await hide(page, "rotated photo");
  const dims = (await text(page)).match(/(\d+) × (\d+) pixels/)!;
  check(Number(dims[2]) > Number(dims[1]), `phone-rotated photo is encoded the way it is displayed (portrait ${dims[1]}×${dims[2]})`);
  await page.close();
}
{
  const page = await newPage();
  await page.goto(base);
  await page.click("text/Create message");
  await (await page.$$("label.btn.file input"))[1].uploadFile(tiny);
  await waitText(page, "too small", 30_000);
  check(true, "a photo under 640 px is refused with a clear message");
  await page.close();
}
{
  const t0 = Date.now();
  const page = await newPage();
  await startCreate(page, big);
  await hide(page, "twelve megapixels");
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const dims = (await text(page)).match(/(\d+) × (\d+) pixels/)!;
  check(Math.max(Number(dims[1]), Number(dims[2])) <= 1280, `a 12 MP photo works and is scaled to ${dims[1]}×${dims[2]} (${secs}s in headless Chrome)`);
  await page.close();
}
{
  const page = await newPage();
  await startCreate(page, jpg);
  const btn = async () => page.evaluate(() => (Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Hide message") as HTMLButtonElement).disabled);
  check(await btn(), "Hide message is disabled with no message");
  await page.type("textarea", "a".repeat(600));
  check((await btn()) && (await text(page)).includes("Too long"), "Hide message is disabled and says 'Too long' above the limit");
  await page.$eval("textarea", (el: any) => { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.click("textarea");
  await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace");
  await page.type("textarea", "ok message");
  check(!(await btn()), "Hide message enables for a valid message");
  await page.click("input[type=checkbox]");
  check(await btn(), "turning on the passcode disables Hide message until a passcode is entered");
  const pw = await page.$$("input[type=password]");
  await pw[0].type("short");
  await pw[1].type("short");
  check(await btn(), "a passcode under 8 characters keeps it disabled");
  await pw[0].type("erpass123");
  check(await btn(), "mismatched passcode confirmation keeps it disabled");
  await pw[1].type("erpass123");
  check(!(await btn()), "matching long passcode enables it");
  await page.close();
}

// ================= 5. Share out (mocked share sheet) -> messenger -> share in (service worker) =================
{
  const page = await newPage({ mockShare: "ok" });
  await startCreate(page, jpg);
  await hide(page, "Share path: meet at nine");
  await page.click("text/Share image");
  await waitText(page, "Shared. In WhatsApp");
  const shared = await page.evaluate(() => (window as any).__shared);
  check(shared.length === 1 && shared[0].type === "image/jpeg" && /^IMG_\d{8}\.jpg$/.test(shared[0].name) && shared[0].keys.join() === "files", "share sheet receives one JPEG with a neutral file name and no text or title");
  const wa = await messenger(shared[0].bytes, 60, "ui-shared-wa60.jpg");

  // deliver it to a fresh page the way Android's share sheet would: a POST to the share target
  const rx = await newPage();
  await rx.goto(base, { waitUntil: "networkidle0" });
  await rx.evaluate(async () => { await navigator.serviceWorker.ready; });
  await rx.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", '<form id="sf" method="post" action="/share-target" enctype="multipart/form-data"><input id="sfi" type="file" name="image"></form>');
  });
  await (await rx.$("#sfi")).uploadFile(wa);
  await Promise.all([rx.waitForNavigation({ waitUntil: "load" }), rx.evaluate(() => (document.getElementById("sf") as HTMLFormElement).submit())]);
  await rx.waitForFunction(() => !!document.querySelector(".message") || !!document.querySelector(".error"), { timeout: 60_000 });
  const got = await rx.evaluate(() => (document.querySelector(".message") as HTMLElement | null)?.innerText ?? "ERROR");
  check(got === "Share path: meet at nine", "photo shared INTO the installed app opens Reveal and shows the exact message (share out -> recompress -> share in)");
  check(!new URL(rx.url()).search.includes("shared"), "the share marker is removed from the address bar");
  const keys = await rx.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, idb: ((await indexedDB.databases?.()) ?? []).length, caches: await Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)])) }));
  const cachedNonShell = (keys.caches as any[]).flatMap(([, urls]) => urls).filter((u: string) => /share|\.jpg|\.jpeg|blob/i.test(u));
  check(keys.ls === 0 && keys.ss === 0 && keys.idb === 0 && cachedNonShell.length === 0, "after a share-in, nothing is stored: no storage entries, no photo in any cache");
  await rx.click("text/Done");
  await waitText(rx, "Hide a message in a photo");
  check(!(await text(rx)).includes("Share path"), "Done clears the message from the screen");
  await rx.close();

  // Discard clears the preview
  await page.click("text/Discard and finish");
  await waitText(page, "Hide a message in a photo");
  check((await page.evaluate(() => document.querySelectorAll("img").length)) === 0, "Discard returns home with no image left on the page");
  await page.close();
}
{
  const page = await newPage({ mockShare: "cancel" });
  await startCreate(page, jpg);
  await hide(page, "cancel path");
  await page.click("text/Share image");
  await waitText(page, "Sharing was cancelled");
  check((await text(page)).includes("Share image"), "cancelling the share sheet keeps the image and the Share button");
  await page.close();
}
{
  const page = await newPage({ mockShare: "none" });
  await startCreate(page, jpg);
  await hide(page, "download path");
  const t = await text(page);
  const dl = await page.evaluate(() => { const a = document.querySelector("a.btn[download]") as HTMLAnchorElement | null; return a ? a.getAttribute("download") : null; });
  check(t.includes("cannot share images directly") && !!dl, "with no share sheet the app offers Save image with instructions");
  await page.close();
}

// ================= 6. Offline =================
{
  const page = await newPage();
  await page.goto(base, { waitUntil: "networkidle0" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await new Promise((r) => setTimeout(r, 800));
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: "load" });
  check((await text(page)).includes("Hide a message in a photo"), "app opens with no connection");
  await page.click("text/Create message");
  await (await page.$$("label.btn.file input"))[1].uploadFile(jpg);
  await page.waitForSelector("textarea", { timeout: 60_000 });
  await hide(page, "offline works");
  check(true, "hiding a message works with no connection");
  await page.setOfflineMode(false);
  await page.close();
}

// ================= 7. Passcode through the UI, and state clearing on leaving =================
{
  const page = await newPage();
  await startCreate(page, jpg);
  await hide(page, "locked: the code is 4471", "three blue herons");
  const bytes: number[] = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch((document.querySelector("img.shot") as HTMLImageElement).src)).arrayBuffer())));
  const inputsLeft = await page.evaluate(() => document.querySelectorAll("input[type=password]").length);
  check(inputsLeft === 0, "passcode fields are gone once the photo is ready");
  await page.close();
  const f = await messenger(bytes, 60, "ui-locked-wa60.jpg");
  check((await reveal(f, "three blue herons")) === "locked: the code is 4471", "locked message recovered with the passcode after recompress");
  check((await reveal(f, "three red herons!!")).startsWith("ERROR: Unable to unlock message"), "wrong passcode gives the generic failure");
  check((await reveal(jpg)).startsWith("ERROR: No supported hidden message found"), "an ordinary photo says no hidden message");
  const damaged = await sharp(f).resize({ width: 300 }).jpeg({ quality: 40 }).toFile(join(out, "ui-damaged.jpg")).then(() => join(out, "ui-damaged.jpg"));
  check((await reveal(damaged)).startsWith("ERROR:"), "a photo shrunk and crushed beyond recovery reports an error, never wrong text");
}

// ================= 8. Accessibility basics and layout =================
for (const [label, w] of [["320 px", 320], ["390 px", 390], ["768 px", 768]] as const) {
  const page = await newPage({ width: w, height: 800 });
  const problems: string[] = [];
  for (const step of ["home", "guide", "create-ready", "result"] as const) {
    await page.goto(base);
    if (step === "guide") await page.click("text/Guide");
    if (step === "create-ready" || step === "result") {
      await page.click("text/Create message");
      await (await page.$$("label.btn.file input"))[1].uploadFile(jpg);
      await page.waitForSelector("textarea", { timeout: 60_000 });
      if (step === "result") await hide(page, "layout check");
    }
    const r = await page.evaluate(() => {
      const names: string[] = [];
      document.querySelectorAll("button, a[href], input, textarea").forEach((el: any) => {
        const label = el.getAttribute("aria-label") || el.innerText?.trim() || (el.labels && Array.from(el.labels).map((l: any) => l.innerText).join(" ").trim()) || el.getAttribute("placeholder");
        if (!label) names.push(el.outerHTML.slice(0, 80));
      });
      const small = Array.from(document.querySelectorAll(".btn")).filter((b: any) => b.offsetParent && b.getBoundingClientRect().height < 44).length;
      return { names, small, overflow: document.documentElement.scrollWidth > window.innerWidth, h1: document.querySelectorAll("h1").length, lang: document.documentElement.lang };
    });
    if (r.names.length) problems.push(`${step}: unnamed controls ${r.names.join("; ")}`);
    if (r.small) problems.push(`${step}: ${r.small} buttons under 44 px high`);
    if (r.overflow) problems.push(`${step}: sideways scroll`);
    if (r.lang !== "en") problems.push("html lang missing");
  }
  check(problems.length === 0, `layout and accessibility at ${label}${problems.length ? ": " + problems.join(" | ") : ""}`);
  await page.close();
}

// ================= 9. Console and security =================
const leak = logs.filter((l) => /locked: the code|three blue|Share path|offline works|twelve mega|Hello via/.test(l));
check(leak.length === 0, "no message text or passcode in the console");
const bad = logs.filter((l) => /^(error|pageerror)/.test(l) || /Content Security Policy/i.test(l));
check(bad.length === 0, `no console errors or CSP violations${bad.length ? ": " + bad.slice(0, 3).join(" | ") : ""}`);

await browser.close();
close();
done();
