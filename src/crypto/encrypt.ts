/** Optional passcode protection: PBKDF2-HMAC-SHA-256 -> AES-256-GCM through the browser's Web Crypto. No custom primitives. */
import { CONFIG, FORMAT_VERSION } from "../config";

const enc = new TextEncoder();

export async function deriveKey(passcode: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const raw = enc.encode(passcode.normalize("NFKC"));
  try {
    const material = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  } finally {
    raw.fill(0);
  }
}

/** The header values are authenticated too, so changing the version or KDF id makes decryption fail. */
export const aadFor = (kdfId: number) => Uint8Array.of(FORMAT_VERSION, kdfId);

export class WeakPasscodeError extends Error {}

export function checkPasscode(passcode: string): void {
  if ([...passcode].length < CONFIG.crypto.minPasscodeLength) throw new WeakPasscodeError(`Use at least ${CONFIG.crypto.minPasscodeLength} characters.`);
}

/** Returns kdfId || salt || nonce || ciphertext+tag. Fresh random salt and nonce every call. */
export async function encryptText(passcode: string, plaintext: Uint8Array): Promise<Uint8Array> {
  checkPasscode(passcode);
  const kdfId = CONFIG.crypto.currentKdf;
  const salt = crypto.getRandomValues(new Uint8Array(CONFIG.crypto.saltBytes));
  const nonce = crypto.getRandomValues(new Uint8Array(CONFIG.crypto.nonceBytes));
  const key = await deriveKey(passcode, salt, CONFIG.crypto.kdf[kdfId].iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aadFor(kdfId) }, key, plaintext));
  const out = new Uint8Array(1 + salt.length + nonce.length + ct.length);
  out[0] = kdfId;
  out.set(salt, 1);
  out.set(nonce, 1 + salt.length);
  out.set(ct, 1 + salt.length + nonce.length);
  return out;
}
