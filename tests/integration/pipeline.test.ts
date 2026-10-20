import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { hideMessage, revealMessage } from "../../src/app/pipeline";
import { AppError } from "../../src/app/errors";
import { prepare } from "../../src/image/engine";
import { recompress, synthPhoto } from "../fixtures/synth";
import { nodeCodec } from "../fixtures/node-codec";

async function receive(jpeg: Uint8Array, quality: number) {
  const o = await sharp(jpeg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return recompress({ data: new Uint8ClampedArray(o.data.buffer, o.data.byteOffset, o.data.byteLength), width: o.info.width, height: o.info.height }, quality);
}

describe("the whole flow: message -> image -> messenger -> message", () => {
  const base = () => prepare(synthPhoto(1280, 960, "pipe"));

  it("plain text, with accents and emoji", async () => {
    const text = "Meet me at 9.\nBring the keys \u{1F511} – café side.";
    const enc = await hideMessage({ base: base(), text, codec: nodeCodec });
    expect(enc.verified).toBe(true);
    const r = revealMessage(await receive(enc.jpeg, 65));
    expect(r).toMatchObject({ kind: "text", text });
  });

  it("passcode protected: right passcode opens it, wrong one fails generically", async () => {
    const text = "the plan is on the second shelf";
    const enc = await hideMessage({ base: base(), text, passcode: "a long passphrase", codec: nodeCodec });
    const r = revealMessage(await receive(enc.jpeg, 60));
    expect(r.kind).toBe("locked");
    if (r.kind !== "locked") return;
    await expect(r.unlock("not the passphrase")).rejects.toMatchObject({ code: "unlock-failed" });
    expect(await r.unlock("a long passphrase")).toBe(text);
  });

  it("an encrypted message needs more room than a plain one, and says so", async () => {
    const small = prepare(synthPhoto(640, 480, "small"));
    const text = "x".repeat(500);
    await expect(hideMessage({ base: small, text, passcode: "a long passphrase", codec: nodeCodec })).rejects.toMatchObject({ code: "message-too-large" });
  });

  it("a plain photograph reports 'no supported hidden message'", async () => {
    await expect(Promise.resolve().then(() => revealMessage(base()))).rejects.toMatchObject({ code: "no-payload" });
  });

  it("rejects empty messages and over-limit messages before doing any work", async () => {
    await expect(hideMessage({ base: base(), text: "   ", codec: nodeCodec })).rejects.toBeInstanceOf(AppError);
    await expect(hideMessage({ base: base(), text: "a".repeat(600), codec: nodeCodec })).rejects.toMatchObject({ code: "message-too-large" });
  });
});
