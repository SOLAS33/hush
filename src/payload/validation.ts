import { CONFIG } from "../config";
import { textToBytes } from "./format";

export type MessageCheck =
  | { ok: true; bytes: number; overSoftLimit: boolean }
  | { ok: false; reason: "empty" | "too-long"; bytes: number };

export function checkMessage(text: string): MessageCheck {
  const bytes = textToBytes(text).length;
  if (text.trim().length === 0) return { ok: false, reason: "empty", bytes };
  if (bytes > CONFIG.payload.hardLimitBytes) return { ok: false, reason: "too-long", bytes };
  return { ok: true, bytes, overSoftLimit: bytes > CONFIG.payload.softLimitBytes };
}

/** Extra bytes encryption adds to the message: kdf id + salt + nonce + GCM tag. */
export const ENCRYPTION_OVERHEAD = 1 + CONFIG.crypto.saltBytes + CONFIG.crypto.nonceBytes + 16;
/** The CRC-32 appended to every body. */
export const FRAMING_OVERHEAD = 4;
