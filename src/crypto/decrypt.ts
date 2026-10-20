import { CONFIG } from "../config";
import { aadFor, deriveKey } from "./encrypt";

/** One generic failure for a wrong passcode, a tampered header or a tampered ciphertext (brief 6.2 and 10). */
export class UnlockError extends Error {
  constructor() {
    super("Unable to unlock message.");
  }
}

export async function decryptText(passcode: string, blob: Uint8Array): Promise<Uint8Array> {
  const { saltBytes, nonceBytes } = CONFIG.crypto;
  try {
    const kdfId = blob[0];
    const params = CONFIG.crypto.kdf[kdfId];
    if (!params || blob.length < 1 + saltBytes + nonceBytes + 16) throw new Error("unsupported");
    const salt = blob.subarray(1, 1 + saltBytes);
    const nonce = blob.subarray(1 + saltBytes, 1 + saltBytes + nonceBytes);
    const ct = blob.subarray(1 + saltBytes + nonceBytes);
    const key = await deriveKey(passcode, salt, params.iterations);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aadFor(kdfId) }, key, ct));
  } catch {
    throw new UnlockError();
  }
}
