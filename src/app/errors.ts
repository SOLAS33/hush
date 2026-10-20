/** One place for every user-facing failure (brief section 10). Messages never include message text, passcodes or image data. */
export type ErrorCode =
  | "unsupported-format"
  | "image-too-small"
  | "message-too-large"
  | "encoding-failed"
  | "share-unsupported"
  | "share-cancelled"
  | "no-payload"
  | "payload-corrupt"
  | "unsupported-version"
  | "unlock-failed"
  | "timeout"
  | "out-of-memory"
  | "weak-passcode"
  | "empty-message";

const TEXT: Record<ErrorCode, string> = {
  "unsupported-format": "This file cannot be read as a photo. Try a JPEG, PNG or WebP image.",
  "image-too-small": "This photo is too small. Choose a larger one, at least 640 pixels on its long side.",
  "message-too-large": "This message is too long for this photo.",
  "encoding-failed": "Something went wrong while hiding the message. Try again or choose another photo.",
  "share-unsupported": "This browser cannot share images directly. Save the image, then send it from WhatsApp.",
  "share-cancelled": "Sharing was cancelled. Your image is still here.",
  "no-payload": "No supported hidden message found.",
  "payload-corrupt": "Unable to recover message.",
  "unsupported-version": "This message was made with a newer version of Hush. Update the app and try again.",
  "unlock-failed": "Unable to unlock message.",
  timeout: "This took too long and was stopped. Try a smaller photo.",
  "out-of-memory": "This device ran out of memory. Close other apps or choose a smaller photo.",
  "weak-passcode": "Use a longer passcode.",
  "empty-message": "Type a message to hide.",
};

export class AppError extends Error {
  constructor(readonly code: ErrorCode, detail?: string) {
    super(detail ?? TEXT[code]);
  }
  get userMessage(): string {
    return this.message || TEXT[this.code];
  }
}

export const messageFor = (code: ErrorCode) => TEXT[code];

/** Turn anything thrown into an AppError without copying its message (which could, in theory, carry content). */
export function toAppError(e: unknown, fallback: ErrorCode = "encoding-failed"): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof RangeError || (e instanceof DOMException && e.name === "QuotaExceededError")) return new AppError("out-of-memory");
  return new AppError(fallback);
}
