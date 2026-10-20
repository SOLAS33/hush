export function Home(p: { onCreate: () => void; onReveal: () => void; onAbout: () => void }) {
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
      <p className="note warn">
        This is a prototype. It has not yet been proven through WhatsApp on every phone. Each photo is tested on your device before you share it, and the app tells you if it fails.
      </p>
      <button className="link" onClick={p.onAbout}>
        How it works and its limits
      </button>
    </section>
  );
}
