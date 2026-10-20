import { describe, expect, it } from "vitest";
import { buildBody, bytesToText, crc32, parseBody, textToBytes } from "../../src/payload/format";
import { checkMessage } from "../../src/payload/validation";
import { decryptText, UnlockError } from "../../src/crypto/decrypt";
import { encryptText, WeakPasscodeError } from "../../src/crypto/encrypt";

describe("payload", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(textToBytes("123456789"))).toBe(0xcbf43926);
  });
  it("round-trips text including non-ASCII", () => {
    const t = "Hello, Dublin - café ☕ 你好";
    expect(bytesToText(parseBody(buildBody(textToBytes(t)))!)).toBe(t);
  });
  it("rejects a body with any flipped bit", () => {
    const b = buildBody(textToBytes("secret"));
    for (let i = 0; i < b.length; i++) {
      const bad = Uint8Array.from(b);
      bad[i] ^= 4;
      expect(parseBody(bad)).toBeNull();
    }
  });
  it("rejects invalid UTF-8 instead of showing replacement characters", () => {
    expect(bytesToText(Uint8Array.of(0xff, 0xfe))).toBeNull();
  });
  it("applies the limits from config", () => {
    expect(checkMessage("  ").ok).toBe(false);
    expect(checkMessage("a".repeat(240))).toMatchObject({ ok: true, overSoftLimit: false });
    expect(checkMessage("a".repeat(241))).toMatchObject({ ok: true, overSoftLimit: true });
    expect(checkMessage("a".repeat(513))).toMatchObject({ ok: false, reason: "too-long" });
    expect(checkMessage("é".repeat(300))).toMatchObject({ ok: false, reason: "too-long" }); // counted in bytes, not characters
  });
});

describe("encryption", () => {
  const pass = "correct horse battery";
  const msg = textToBytes("meet at the usual place at 9");

  it("decrypts with the right passcode", async () => {
    const blob = await encryptText(pass, msg);
    expect(Array.from(await decryptText(pass, blob))).toEqual(Array.from(msg));
  });
  it("fails generically with the wrong passcode", async () => {
    const blob = await encryptText(pass, msg);
    await expect(decryptText("wrong passphrase!!", blob)).rejects.toBeInstanceOf(UnlockError);
  });
  it("fails on any altered byte: kdf id, salt, nonce, ciphertext, tag", async () => {
    const blob = await encryptText(pass, msg);
    for (const i of [0, 1, 8, 17, 20, 29, blob.length - 1]) {
      const bad = Uint8Array.from(blob);
      bad[i] ^= 1;
      await expect(decryptText(pass, bad), `byte ${i}`).rejects.toBeInstanceOf(UnlockError);
    }
  });
  it("uses a fresh salt and nonce each time", async () => {
    const a = await encryptText(pass, msg);
    const b = await encryptText(pass, msg);
    expect(Array.from(a.subarray(1, 29))).not.toEqual(Array.from(b.subarray(1, 29)));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
  it("refuses a short passcode", async () => {
    await expect(encryptText("short", msg)).rejects.toBeInstanceOf(WeakPasscodeError);
  });
  it("does not contain the plaintext", async () => {
    const blob = await encryptText(pass, msg);
    expect(new TextDecoder("latin1").decode(blob)).not.toContain("usual place");
  });
});
