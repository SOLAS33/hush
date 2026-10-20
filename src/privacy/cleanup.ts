/**
 * Keeps track of everything holding photo or message content so "Done" can drop it all.
 * A browser cannot promise to wipe every copy from memory; this removes our references and zeroes the buffers we own.
 */
const urls = new Set<string>();
const buffers = new Set<Uint8Array | Uint8ClampedArray>();

/** Make an object URL that will be revoked by `clearAll`. */
export function trackedUrl(blob: Blob): string {
  const u = URL.createObjectURL(blob);
  urls.add(u);
  return u;
}

export function revoke(u: string | null | undefined): void {
  if (!u) return;
  URL.revokeObjectURL(u);
  urls.delete(u);
}

export function trackBuffer<T extends Uint8Array | Uint8ClampedArray>(b: T): T {
  buffers.add(b);
  return b;
}

export function wipe(b: Uint8Array | Uint8ClampedArray | null | undefined): void {
  if (!b) return;
  b.fill(0);
  buffers.delete(b);
}

export function clearAll(): void {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear();
  for (const b of buffers) b.fill(0);
  buffers.clear();
}
