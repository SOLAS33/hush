/** Glue between the UI and the engine: message text <-> bytes <-> image. No DOM here, so it is tested in Node. */
import { FORMAT_VERSION } from "../config";
import { decryptText, UnlockError } from "../crypto/decrypt";
import { checkPasscode, encryptText, WeakPasscodeError } from "../crypto/encrypt";
import { CapacityError, bodyCapacity, decode, encode, type Encoded, type JpegCodec } from "../image/engine";
import type { Raster } from "../image/pixels";
import { FLAG_ENCRYPTED, buildBody, bytesToText, parseBody, textToBytes } from "../payload/format";
import { checkMessage } from "../payload/validation";
import { AppError } from "./errors";

export interface HideArgs {
  base: Raster; // already prepared (scaled, cropped to blocks)
  text: string;
  passcode?: string; // present = encrypt
  codec: JpegCodec;
  onProgress?: (note: string) => void;
}

export async function hideMessage(a: HideArgs): Promise<Encoded> {
  const check = checkMessage(a.text);
  if (!check.ok) throw new AppError(check.reason === "empty" ? "empty-message" : "message-too-large", check.reason === "too-long" ? "This message is too long. The limit is a few hundred characters." : undefined);

  let content = textToBytes(a.text);
  let flags = 0;
  if (a.passcode !== undefined) {
    try {
      checkPasscode(a.passcode);
    } catch (e) {
      if (e instanceof WeakPasscodeError) throw new AppError("weak-passcode", e.message);
      throw e;
    }
    a.onProgress?.("Locking the message");
    content = await encryptText(a.passcode, content);
    flags |= FLAG_ENCRYPTED;
  }
  const body = buildBody(content);
  const cap = bodyCapacity(a.base.width, a.base.height);
  if (body.length > cap) throw new AppError("message-too-large", `This message does not fit this photo. Shorten it${flags ? " or turn off the passcode" : ""}, or choose a larger photo.`);
  try {
    return await encode(a.base, flags, body, a.codec, a.onProgress);
  } catch (e) {
    if (e instanceof CapacityError) throw new AppError("message-too-large");
    throw e;
  }
}

export type Reveal =
  | { kind: "text"; text: string }
  | { kind: "locked"; unlock: (passcode: string) => Promise<string> };

/** Throws AppError("no-payload" | "payload-corrupt" | "unsupported-version"). Never returns partial text. */
export function revealMessage(img: Raster): Reveal {
  const r = decode(img);
  if (r.status === "none") throw new AppError("no-payload");
  if (r.status === "version") throw new AppError("unsupported-version");
  if (r.status === "corrupt") throw new AppError("payload-corrupt");
  const content = parseBody(r.body);
  if (!content) throw new AppError("payload-corrupt");
  if (r.flags & FLAG_ENCRYPTED) {
    return {
      kind: "locked",
      async unlock(passcode: string) {
        try {
          const plain = await decryptText(passcode, content);
          const text = bytesToText(plain);
          plain.fill(0);
          if (text === null) throw new UnlockError();
          return text;
        } catch {
          throw new AppError("unlock-failed");
        }
      },
    };
  }
  const text = bytesToText(content);
  if (text === null) throw new AppError("payload-corrupt");
  return { kind: "text", text };
}

export { FORMAT_VERSION };
