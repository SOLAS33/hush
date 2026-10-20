export function About(p: { onBack: () => void }) {
  return (
    <section className="stack prose">
      <h1>How it works</h1>
      <p>Hush changes the fine detail of a photo in a way the eye does not notice, and stores your message in those changes. The message is spread across the whole picture with error correction, so it can survive the photo being compressed again when WhatsApp sends it.</p>
      <p>Everything runs in this page, on your phone. The photo, the message and any passcode are never sent to a server, and nothing is kept after you press Done.</p>

      <h2>Passcode</h2>
      <p>A passcode is optional. With one, the message is locked with AES-256-GCM before it is hidden, using a key made from your passcode. Without one, anyone who runs the photo through Hush can read the message. Share the passcode some other way than the photo.</p>

      <h2>Limits you should know about</h2>
      <ul>
        <li>Whether a photo survives WhatsApp depends on how WhatsApp treats it, and that can change. Hush tests each photo against a range of re-compression on your own phone before it offers it, and warns you if it did not pass. It cannot test WhatsApp itself, so ask the other person to confirm the first time.</li>
        <li>Send the photo as a normal photo. Screenshots, crops, filters, and edits will destroy the message.</li>
        <li>Messages are short: about 240 characters, up to 512 bytes. Passcode protection uses 45 bytes of that room.</li>
        <li>Photos with fine detail (trees, fabric, a crowd) work best. Large smooth areas such as sky or a plain wall carry less safely.</li>
        <li>Hush does not make a photo undetectable. Someone with the right tools can find that a photo has been altered. It is not a replacement for encrypted messaging.</li>
        <li>The photo you share is made smaller (up to 1280 pixels on its longest side), so that WhatsApp has no reason to resize it.</li>
        <li>WhatsApp, your phone's photo library and your backups may keep the photo. Hush cannot control that.</li>
        <li>Sharing into the app from WhatsApp works on Android once Hush is installed. On iPhone, open Hush, tap Reveal message and choose the photo.</li>
      </ul>
      <h2>Version</h2>
      <p>Hush 1.0. Free, open source (MIT) at github.com/SOLAS33/hush. Made by Solas33.</p>
      <button className="btn" onClick={p.onBack}>
        Back
      </button>
    </section>
  );
}
