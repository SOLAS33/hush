import { useEffect, useRef, useState } from "react";
import { AppError, toAppError } from "../app/errors";
import { revealMessage, type Reveal as RevealResult } from "../app/pipeline";
import { CONFIG } from "../config";
import { loadForDecoding } from "../image/image-utils";
import { wipe } from "../privacy/cleanup";

type State =
  | { s: "pick" }
  | { s: "working" }
  | { s: "locked"; unlock: (p: string) => Promise<string> }
  | { s: "shown"; text: string }
  | { s: "error"; message: string; detail?: string };

const tick = () => new Promise<void>((r) => setTimeout(r, 30));

export function Reveal({ initialFile, onExit }: { initialFile: File | null; onExit: () => void }) {
  const [state, setState] = useState<State>(initialFile ? { s: "working" } : { s: "pick" });
  const [pass, setPass] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const started = useRef(false);

  // Clear everything this screen holds, whichever way it is left.
  useEffect(
    () => () => {
      setPass("");
    },
    []
  );

  async function open(file: File) {
    setState({ s: "working" });
    await tick();
    let raster = null;
    try {
      raster = await Promise.race([
        loadForDecoding(file),
        new Promise<never>((_, rej) => setTimeout(() => rej(new AppError("timeout")), CONFIG.timeouts.processingMs)),
      ]);
      const r: RevealResult = revealMessage(raster);
      if (r.kind === "text") setState({ s: "shown", text: r.text });
      else setState({ s: "locked", unlock: r.unlock });
    } catch (e) {
      const err = toAppError(e, "payload-corrupt");
      // Size and type help when testing a round trip; they say nothing about the message.
      const detail = raster
        ? `Received image: ${raster.width} × ${raster.height} pixels, ${(file.size / 1024).toFixed(0)} KB, ${file.type || "unknown type"}.`
        : undefined;
      setState({ s: "error", message: err.userMessage, detail });
    } finally {
      wipe(raster?.data);
    }
  }

  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      void open(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPass(unlock: (p: string) => Promise<string>) {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const text = await unlock(pass);
      setState({ s: "shown", text });
    } catch (e) {
      setUnlockError(toAppError(e, "unlock-failed").userMessage);
    } finally {
      setPass("");
      setUnlocking(false);
    }
  }

  if (state.s === "shown") {
    return (
      <section className="stack">
        <p className="message" role="status">{state.text}</p>
        <button className="btn primary big" onClick={onExit}>
          Done
        </button>
      </section>
    );
  }

  if (state.s === "locked") {
    return (
      <section className="stack">
        <h1>This message is locked</h1>
        <form
          className="stack tight"
          onSubmit={(e) => {
            e.preventDefault();
            void submitPass(state.unlock);
          }}
        >
          <label className="field">
            <span>Passcode</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" autoCapitalize="off" autoFocus />
          </label>
          <button className="btn primary big" type="submit" disabled={unlocking || pass.length === 0}>
            {unlocking ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        {unlockError && <p className="error" role="alert">{unlockError}</p>}
        <button className="link" onClick={onExit}>
          Cancel
        </button>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Reveal message</h1>
      {state.s === "pick" && (
        <>
          <p className="lead">Choose the photo you received. On iPhone, save it from WhatsApp to Photos first. On Android you can also share it straight to Hush.</p>
          <label className="btn primary big file">
            Choose photo
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void open(e.target.files[0])} />
          </label>
        </>
      )}
      {state.s === "working" && <p className="note" role="status">Looking for a message…</p>}
      {state.s === "error" && (
        <>
          <p className="error" role="alert">{state.message}</p>
          {state.detail && (
            <details>
              <summary>Technical details</summary>
              <p className="note">{state.detail}</p>
            </details>
          )}
          <label className="btn primary big file">
            Try another photo
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void open(e.target.files[0])} />
          </label>
        </>
      )}
      <button className="link" onClick={onExit}>
        Cancel
      </button>
    </section>
  );
}
