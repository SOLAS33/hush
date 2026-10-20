/** What kind of install help to show. Feature-detected; nothing is sent anywhere. */

export type InstallState =
  | { kind: "installed" } // already running as an app
  | { kind: "prompt"; prompt: () => Promise<void> } // Chromium offered a one-tap install
  | { kind: "ios-safari" }
  | { kind: "ios-other" } // iPhone, but not Safari
  | { kind: "android" }
  | { kind: "other" };

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function listenForInstallPrompt(): void {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isStandalone(): boolean {
  return matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function installState(): InstallState {
  if (isStandalone()) return { kind: "installed" };
  if (deferred) {
    const d = deferred;
    return {
      kind: "prompt",
      prompt: async () => {
        await d.prompt();
        await d.userChoice;
        deferred = null;
        listeners.forEach((l) => l());
      },
    };
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? { kind: "ios-other" } : { kind: "ios-safari" };
  if (/Android/.test(ua)) return { kind: "android" };
  return { kind: "other" };
}
