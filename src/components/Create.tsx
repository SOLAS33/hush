import { useEffect, useMemo, useRef, useState } from "react";
import { AppError, toAppError } from "../app/errors";
import { hideMessage } from "../app/pipeline";
import { CONFIG } from "../config";
import { bodyCapacity, prepare } from "../image/engine";
import { canvasCodec, loadForEncoding } from "../image/image-utils";
import type { Raster } from "../image/pixels";
import { checkMessage, ENCRYPTION_OVERHEAD, FRAMING_OVERHEAD } from "../payload/validation";
import { clearAll, trackedUrl, wipe } from "../privacy/cleanup";
import { canShareFile, makeShareFile, shareFile } from "../platform/share-out";

interface Result {
  file: File;
  url: string;
  verified: boolean;
  width: number;
  height: number;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 30));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new AppError("timeout")), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e))
    );
  });
}

export function Create({ onExit }: { onExit: () => void }) {
  const [base, setBase] = useState<Raster | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [protect, setProtect] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const baseRef = useRef<Raster | null>(null);

  useEffect(() => () => {
    wipe(baseRef.current?.data);
    clearAll();
  }, []);

  const capacity = useMemo(() => {
    if (!base) return 0;
    const room = bodyCapacity(base.width, base.height) - FRAMING_OVERHEAD - (protect ? ENCRYPTION_OVERHEAD : 0);
    return Math.max(0, Math.min(room, CONFIG.payload.hardLimitBytes));
  }, [base, protect]);

  const check = checkMessage(text);
  const bytes = check.bytes;
  const tooLongForPhoto = base !== null && bytes > capacity;
  const passOk = !protect || ([...pass].length >= CONFIG.crypto.minPasscodeLength && pass === pass2);
  const canHide = base !== null && check.ok && !tooLongForPhoto && passOk && !busy;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("Reading the photo");
    await tick();
    try {
      const raw = await withTimeout(loadForEncoding(file), CONFIG.timeouts.processingMs);
      const r = prepare(raw);
      wipe(baseRef.current?.data);
      baseRef.current = r;
      setBase(r);
      setPreview(trackedUrl(file));
    } catch (e) {
      setError(toAppError(e, "unsupported-format").userMessage);
    } finally {
      setBusy(null);
    }
  }

  async function hide() {
    if (!base) return;
    setError(null);
    setNote(null);
    setBusy("Hiding the message");
    await tick();
    try {
      const enc = await withTimeout(
        hideMessage({ base, text, passcode: protect ? pass : undefined, codec: canvasCodec, onProgress: (n) => setBusy(n) }),
        CONFIG.timeouts.processingMs * 2
      );
      const file = makeShareFile(enc.jpeg);
      setResult({ file, url: trackedUrl(file), verified: enc.verified, width: enc.width, height: enc.height });
      setPass("");
      setPass2("");
    } catch (e) {
      setError(toAppError(e).userMessage);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!result) return;
    setError(null);
    try {
      await shareFile(result.file);
      setNote("Shared. In WhatsApp, send it as a normal photo with any caption you like.");
    } catch (e) {
      const err = toAppError(e, "share-unsupported");
      if (err.code === "share-cancelled") setNote(err.userMessage);
      else setError(err.userMessage);
    }
  }

  if (result) {
    return (
      <section className="stack">
        <h1>Ready to send</h1>
        <img className="shot" src={result.url} alt="The photo with the message hidden in it" />
        {result.verified ? (
          <p className="note ok">Tested on this phone against repeated compression: the message came back exactly each time.</p>
        ) : (
          <p className="note warn">This photo did not pass every compression test. The message may not survive WhatsApp. A busier photo, or a shorter message, gives better odds.</p>
        )}
        <p className="note">
          {result.width} × {result.height} pixels, {(result.file.size / 1024).toFixed(0)} KB.
        </p>
        {canShareFile(result.file) ? (
          <button className="btn primary big" onClick={share}>
            Share image
          </button>
        ) : (
          <>
            <p className="note warn">This browser cannot share images directly. Save the image, then attach it from WhatsApp as a photo.</p>
            <a className="btn primary big" href={result.url} download={result.file.name}>
              Save image
            </a>
          </>
        )}
        {note && <p className="note ok">{note}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" onClick={onExit}>
          Discard and finish
        </button>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Create message</h1>
      {!base ? (
        <>
          <p className="lead">Choose the photo that will carry the message. A detailed photo with natural texture works best.</p>
          <label className="btn primary big file">
            Take photo
            <input type="file" accept="image/*" capture="environment" onChange={(e) => pick(e.target.files?.[0])} disabled={!!busy} />
          </label>
          <label className="btn big file">
            Choose photo
            <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} disabled={!!busy} />
          </label>
        </>
      ) : (
        <>
          {preview && <img className="shot small" src={preview} alt="Your chosen photo" />}
          <button
            className="link"
            onClick={() => {
              wipe(baseRef.current?.data);
              baseRef.current = null;
              setBase(null);
              setPreview(null);
            }}
          >
            Use a different photo
          </button>

          <label className="field">
            <span>Hidden message</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} spellCheck autoComplete="off" placeholder="One or two short lines" />
            <small className={tooLongForPhoto || !check.ok && check.reason === "too-long" ? "bad" : check.ok && check.overSoftLimit ? "warnc" : ""}>
              {bytes} of {capacity} bytes
              {check.ok && check.overSoftLimit && !tooLongForPhoto ? ". Long messages are less likely to survive." : ""}
              {tooLongForPhoto ? ". Too long for this photo." : ""}
            </small>
          </label>

          <label className="check">
            <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
            <span>Protect with passcode</span>
          </label>
          {protect && (
            <div className="stack tight">
              <label className="field">
                <span>Passcode</span>
                <input type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" autoCapitalize="off" />
              </label>
              <label className="field">
                <span>Confirm passcode</span>
                <input type={show ? "text" : "password"} value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="off" autoCapitalize="off" />
              </label>
              <label className="check">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                <span>Show passcode</span>
              </label>
              <small className={passOk || (!pass && !pass2) ? "" : "bad"}>
                At least {CONFIG.crypto.minPasscodeLength} characters. A few random words is better than a short number. Tell the other person the passcode some way other than this photo.
              </small>
            </div>
          )}
          <button className="btn primary big" onClick={hide} disabled={!canHide}>
            Hide message
          </button>
        </>
      )}
      {busy && <p className="note" role="status">{busy}…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="link" onClick={onExit}>
        Cancel
      </button>
    </section>
  );
}
