/**
 * Receiving a picture shared INTO the installed app (Web Share Target, Android Chrome and similar).
 * The service worker holds the file in its own memory only (never in a cache or database) and the page collects it once.
 * iOS Safari does not offer this; the "Choose a photo" picker is the route there and everywhere.
 */
export const SHARE_QUERY = "shared";

export function hasPendingShare(): boolean {
  return new URLSearchParams(location.search).has(SHARE_QUERY);
}

/** Asks the service worker for the file it is holding, once. Returns null if there is none (or no service worker). */
export async function claimSharedImage(timeoutMs = 4000): Promise<File | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  const target = reg.active;
  if (!target) return null;
  return new Promise<File | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (ev: MessageEvent) => {
      clearTimeout(timer);
      const file = ev.data?.file;
      resolve(file instanceof Blob ? new File([file], "received.jpg", { type: file.type || "image/jpeg" }) : null);
    };
    target.postMessage({ type: "hush-claim-share" }, [channel.port2]);
  });
}

/** Remove the marker from the address bar so a refresh does not look for the file again. */
export function forgetShareMarker(): void {
  const url = new URL(location.href);
  url.searchParams.delete(SHARE_QUERY);
  history.replaceState(null, "", url.pathname + (url.search || ""));
}
