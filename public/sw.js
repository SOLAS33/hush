/*
 * Hush service worker.
 *  - Caches the app shell (the built files listed below) so the app opens offline.
 *  - Receives a photo shared into the installed app and holds it IN MEMORY until the page collects it once.
 *  - Never caches photos, shared files, responses to POSTs or anything outside the app shell. Nothing here touches IndexedDB.
 */
const VERSION = "__VERSION__";
const CACHE = "hush-shell-" + VERSION;
const SHELL = /*PRECACHE*/[];

let held = null; // File shared into the app, waiting to be collected. Lives only as long as this worker does.

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("hush-shell-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const file = form.get("image");
          held = file instanceof File && file.type.startsWith("image/") ? file : null;
        } catch {
          held = null;
        }
        return Response.redirect("/?shared=1", 303);
      })()
    );
    return;
  }

  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    // network first so a new version is picked up; fall back to the cached shell when offline
    event.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "hush-claim-share" && event.ports[0]) {
    event.ports[0].postMessage({ file: held });
    held = null;
  }
});
