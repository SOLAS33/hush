import { useEffect, useState } from "react";
import { installState, onInstallChange, type InstallState } from "../platform/install";
import { INSTALL_ANDROID, INSTALL_IPHONE } from "./guide-content";

function InstallCard() {
  const [state, setState] = useState<InstallState>(installState);
  useEffect(() => onInstallChange(() => setState(installState())), []);
  if (state.kind === "installed") return null;

  const steps = state.kind === "ios-safari" ? INSTALL_IPHONE : state.kind === "android" || state.kind === "prompt" ? INSTALL_ANDROID : null;
  return (
    <section className="card" aria-labelledby="install-h">
      <h2 id="install-h">Get the app</h2>
      {state.kind === "prompt" && (
        <>
          <p className="note">Install Hush to open it like any other app, even with no signal.</p>
          <button className="btn primary big" onClick={() => void state.prompt()}>
            Install app
          </button>
        </>
      )}
      {state.kind === "ios-other" && (
        <p className="note">
          You are using a browser on iPhone that cannot install apps this way. Open <strong>hush.solas33.com</strong> in <strong>Safari</strong>, then follow the steps for iPhone below.
        </p>
      )}
      {steps && (
        <details open={state.kind !== "prompt"}>
          <summary>{steps.heading}</summary>
          <ol className="steps">
            {steps.steps!.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
      )}
      {state.kind === "other" && (
        <p className="note">
          On a computer, Hush works in the browser, but it is made for phones. Open <strong>hush.solas33.com</strong> on your iPhone (in Safari) or Android phone (in Chrome) to install it.
        </p>
      )}
    </section>
  );
}

export function Home(p: { onCreate: () => void; onReveal: () => void; onGuide: () => void; onAbout: () => void }) {
  return (
    <section className="stack">
      <h1>Hide a message in a photo.</h1>
      <p className="lead">Pick a photo, type a short message, and send the photo in WhatsApp as normal. The other person opens it in Hush to read the message.</p>
      <button className="btn primary big" onClick={p.onCreate}>
        Create message
      </button>
      <button className="btn big" onClick={p.onReveal}>
        Reveal message
      </button>
      <p className="note">Messages are processed on your device. The app does not keep a message history.</p>

      <section className="card" aria-labelledby="how-h">
        <h2 id="how-h">How to use Hush</h2>
        <ol className="steps">
          <li><strong>Create.</strong> Choose a photo, type your message, and optionally add a passcode.</li>
          <li><strong>Send.</strong> Tap Share image and send it in WhatsApp as a normal photo.</li>
          <li><strong>Reveal.</strong> The other person saves the photo, opens Hush and taps Reveal message.</li>
          <li><strong>Done.</strong> Close the message and nothing is kept.</li>
        </ol>
        <button className="link" onClick={p.onGuide}>
          Read the full guide
        </button>
      </section>

      <InstallCard />

      <p className="note">Each photo is tested against repeated compression on your phone before you share it. If it fails the test, Hush tells you.</p>
      <nav className="foot" aria-label="More">
        <button className="link" onClick={p.onGuide}>Guide</button>
        <button className="link" onClick={p.onAbout}>How it works and its limits</button>
      </nav>
    </section>
  );
}
