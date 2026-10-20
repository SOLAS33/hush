/** Hand the finished image to the phone's own share sheet. Feature-detected, with a save-image fallback. */
import { AppError } from "../app/errors";

export function makeShareFile(jpeg: Uint8Array): File {
  // A neutral file name: nothing in it says what is inside.
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new File([jpeg as BlobPart], `IMG_${stamp}.jpg`, { type: "image/jpeg" });
}

export function canShareFile(file: File): boolean {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

/** Must be called straight from a tap. Resolves when the sheet closes; throws share-cancelled if the person backs out. */
export async function shareFile(file: File): Promise<void> {
  if (!canShareFile(file)) throw new AppError("share-unsupported");
  try {
    await navigator.share({ files: [file] });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AppError("share-cancelled");
    throw new AppError("share-unsupported");
  }
}
