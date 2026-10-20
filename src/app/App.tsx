import { useCallback, useEffect, useState } from "react";
import { clearAll } from "../privacy/cleanup";
import { claimSharedImage, forgetShareMarker, hasPendingShare } from "../platform/share-in";
import { About } from "../components/About";
import { Guide } from "../components/Guide";
import { listenForInstallPrompt } from "../platform/install";
import { Create } from "../components/Create";
import { Home } from "../components/Home";
import { Reveal } from "../components/Reveal";

export type Screen = "home" | "create" | "reveal" | "guide" | "about";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [shared, setShared] = useState<File | null>(null);
  // Bumped on every return to home so each screen starts from nothing.
  const [session, setSession] = useState(0);

  const goHome = useCallback(() => {
    clearAll();
    setShared(null);
    setSession((n) => n + 1);
    setScreen("home");
  }, []);

  // A photo shared into the installed app goes straight to Reveal.
  useEffect(() => {
    if (!hasPendingShare()) return;
    let cancelled = false;
    claimSharedImage().then((f) => {
      forgetShareMarker();
      if (cancelled || !f) return;
      setShared(f);
      setScreen("reveal");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    listenForInstallPrompt();
  }, []);

  // Leaving the app clears anything that was on screen.
  useEffect(() => {
    const onHide = () => clearAll();
    addEventListener("pagehide", onHide);
    return () => removeEventListener("pagehide", onHide);
  }, []);

  return (
    <main className="app">
      <header className="top">
        <button className="brand" onClick={goHome} aria-label="Hush home">
          <span className="mark" aria-hidden="true">
            <i /><i /><i />
          </span>
          Hush
        </button>
        <button className="link top-link" onClick={() => setScreen("guide")}>Guide</button>
      </header>
      {screen === "home" && <Home onCreate={() => setScreen("create")} onReveal={() => setScreen("reveal")} onGuide={() => setScreen("guide")} onAbout={() => setScreen("about")} />}
      {screen === "create" && <Create key={session} onExit={goHome} />}
      {screen === "reveal" && <Reveal key={session} initialFile={shared} onExit={goHome} />}
      {screen === "guide" && <Guide onBack={goHome} />}
      {screen === "about" && <About onBack={goHome} />}
    </main>
  );
}
