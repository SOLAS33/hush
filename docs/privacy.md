# Privacy

## What happens to your data

| Item | Where it goes | How long |
|---|---|---|
| The photo you choose | Decoded and scaled in this page's memory | Until you press Done, Cancel or Discard, or leave the app |
| The message you type | This page's memory | Same |
| The passcode | The input box, then cleared as soon as it has been used | Seconds |
| The encryption key | Made from the passcode, not extractable, held by the browser's crypto engine | Until the operation finishes |
| The finished photo | An object URL in this page and, if you share it, the share sheet | Until Done or leaving the app |
| A recovered message | This page's memory, shown on screen | Until you press Done or leave the app |

Nothing is sent to a server. The app makes no network requests after it loads, other than fetching its own files. There is no account, no analytics, no advertising and no third-party script. The security policy (`public/_headers`) allows connections to the app's own origin only, so even a bug could not send data elsewhere.

## What the app does not store

No local storage, session storage, IndexedDB or cache entry ever holds a photo, message, passcode or recovered text. The end-to-end test checks this after creating a message. The service worker caches only the app's own built files.

When a photo is shared into the installed app (Android), the service worker holds it in memory until the page collects it once, then drops it. If the worker is stopped by the browser in between, the photo is lost and you choose it again.

## Logs and addresses

No message text, passcode, key or image data is written to the console or placed in a web address. The end-to-end test checks the console. Error messages are fixed sentences.

## What the app cannot control

* The photo you share is an ordinary file. WhatsApp, your phone's photo library, the share target you choose and your device backups may keep copies. The message is inside the photo.
* A browser cannot promise to erase every copy of data from memory. Hush drops its references, revokes its object URLs and zeroes the buffers it owns.
* Without a passcode, anyone who has the photo and the app can read the message.
* The web server that hosts the app can see that your device fetched the app's files, as any web server can. It never sees photos or messages.

## Not a secrecy guarantee

Hiding a message in a photo is not the same as encrypting it, and it does not make the photo undetectable. Use the passcode if the content matters, and use an end-to-end encrypted messenger for anything that needs strong protection.
