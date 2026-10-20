# Hush

Hide a short message in a photograph, send the photograph in WhatsApp as normal, and reveal the message on the other phone. Free, no account, no server. Everything happens on the device.

**Live:** https://hush.solas33.com (installable web app for iPhone and Android)
**Version:** 1.0. The app is complete and passes 26 unit and integration tests and 74 browser checks in real Chrome. One thing is still unproven: **real WhatsApp transfers on iPhone and Android** (the engine is proven against simulated JPEG recompression and Chrome's own encoder, and Hush tests every photo on the phone before offering it). Run [docs/device-test-matrix.md](docs/device-test-matrix.md) to close that gap.

## How it works

1. You pick or take a photo and type a message (up to about 240 characters). A passcode is optional.
2. Hush scales the photo to at most 1280 pixels on its long side, and writes the message into the fine detail of the picture (mid-frequency JPEG coefficients, spread across the whole image, with Reed-Solomon error correction).
3. Before it offers the result, Hush rehearses what a messenger does. It recompresses the photo at five JPEG qualities on your own phone and reads the message back each time. It uses the weakest (least visible) strength that passes everything. If nothing passes, it says so.
4. You share the image through the phone's share sheet, choose WhatsApp, and add any caption.
5. The other person opens Hush, taps Reveal message and picks the photo (on Android they can share it straight into the installed app). The message appears. Press Done and it is gone.

## What it does not do

* It does not make a photo undetectable. It is not a substitute for end-to-end encrypted messaging. With a passcode the text is locked with AES-256-GCM, but the existence of an altered photo can still be found by someone with the right tools.
* A screenshot, crop, filter or edit destroys the message.
* It does not keep a history. It does not send anything to a server. See [docs/privacy.md](docs/privacy.md).

Full list of limits: [docs/STATUS.md](docs/STATUS.md).

## Run it

```
npm install
npm run dev          # local development server
npm test             # unit and integration tests (engine, error correction, payload, encryption, whole flow)
npm run build        # production build into dist/
npm run test:e2e     # real Chrome: hide, recompress, reveal; privacy and security-header checks (needs a build and Chrome)
npm run report       # recovery rate and image quality across JPEG qualities and strengths
```

Node 22 or newer.

## Layout

```
src/config.ts        every tunable value in one place
src/image/           embed-core (the engine), engine (encode/decode pipeline), pixels, image-utils (canvas), prng
src/payload/         reed-solomon, format (framing, CRC), validation (limits)
src/crypto/          encrypt, decrypt (PBKDF2 + AES-GCM via Web Crypto)
src/platform/        share-out (share sheet), share-in (receive a shared photo)
src/privacy/         cleanup (drop references, revoke URLs, zero buffers)
src/app, components/ the interface
public/              manifest, service worker, icons, security headers
tests/               unit, integration, e2e, fixtures
tools/               robustness report, baseline comparison, icon generator
docs/                architecture, algorithm evaluation, payload format, privacy, device tests, deployment, third-party
```

## Documents

* [Architecture](docs/architecture.md)
* [Algorithm evaluation](docs/algorithm-evaluation.md) (the feasibility report the design brief asks for)
* [Payload format](docs/payload-format.md)
* [Privacy](docs/privacy.md)
* [Device test matrix](docs/device-test-matrix.md) (the approval gate: run this on a real iPhone and Android)
* [Deployment](docs/deployment.md)
* [Third-party software and licences](docs/third-party.md)
* [Status, known limits and next steps](docs/STATUS.md)
* [User guide](docs/user-guide.md) (install and use, for iPhone and Android)
* [Original design brief](docs/design-brief.md)

Licence: MIT (see [LICENSE](LICENSE)). The owner may change this before wider release.
