/** Shared helpers for the browser tests: a static server with the real _headers, a launched Chrome, and a tiny check() reporter. */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

export const root = join(import.meta.dirname, "..", "..");
export const dist = join(root, "dist");
export const out = join(import.meta.dirname, "out");

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };

export async function serveDist(): Promise<{ base: string; close: () => void }> {
  const rules: Array<{ path: string; headers: Record<string, string> }> = [];
  let cur: { path: string; headers: Record<string, string> } | null = null;
  for (const line of readFileSync(join(dist, "_headers"), "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ")) rules.push((cur = { path: line.trim(), headers: {} }));
    else if (cur) {
      const i = line.indexOf(":");
      cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const server = createServer((req, res) => {
    const p = new URL(req.url!, "http://x").pathname;
    let file = join(dist, p === "/" ? "index.html" : p);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
    const h: Record<string, string> = { "Content-Type": types[extname(file)] ?? "application/octet-stream" };
    for (const r of rules) if (r.path === "/*" || r.path === p || (r.path.endsWith("/*") && p.startsWith(r.path.slice(0, -1)))) Object.assign(h, r.headers);
    // Test only: lets the test read a produced blob back. The shipped policy has no blob: in connect-src.
    if (h["Content-Security-Policy"]) h["Content-Security-Policy"] = h["Content-Security-Policy"].replace("connect-src 'self'", "connect-src 'self' blob:");
    res.writeHead(200, h).end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, close: () => server.close() };
}

export async function launch() {
  const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
  if (!chrome) throw new Error("No Chrome found. Set CHROME_PATH.");
  return puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
}

export function reporter() {
  let failures = 0;
  return {
    check(ok: boolean, what: string) {
      console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
      if (!ok) failures++;
    },
    done(): never {
      console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
      process.exit(failures ? 1 : 0);
    },
    get failures() {
      return failures;
    },
  };
}

export const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
export const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
export const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
