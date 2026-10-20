# Architecture

Hush is a static web app (TypeScript, React, Vite). There is no backend. Cloudflare serves the files; everything else runs in the browser.

## Modules

| Module | Folder | Role | Browser APIs |
|---|---|---|---|
| Interface | `src/app`, `src/components` | Screens, state. Holds no image or crypto algorithm | DOM |
| Image processing | `src/image` | `embed-core` (engine), `engine` (prepare, encode with self-test, decode with rescale), `pixels` (resize, crop, PSNR, SSIM), `image-utils` (file to pixels, pixels to JPEG) | Canvas, ImageBitmap (only `image-utils`) |
| Payload | `src/payload` | Framing, CRC, Reed-Solomon, message limits | none |
| Cryptography | `src/crypto` | PBKDF2 key, AES-256-GCM | Web Crypto |
| Platform | `src/platform` | Share sheet out, shared photo in | Web Share, service worker messages |
| Privacy | `src/privacy` | Track and drop object URLs and buffers | URL |

`embed-core`, `engine`, `pixels`, `payload`, `crypto` and `app/pipeline` need no DOM, so the same code that runs on the phone is tested in Node. The only browser-specific piece of the image path is the JPEG codec: the app supplies a canvas codec, the tests supply libjpeg (sharp), and the end-to-end test uses the real canvas codec in Chrome.

## Data flow

Create: file → `loadForEncoding` (decode, rotate, scale to at most 1280 px, multiple of 8) → `hideMessage` (limits, optional encrypt, CRC, capacity check) → `encode` (for each strength: embed, make the shared JPEG, rehearse recompression at five qualities, read back) → share sheet or download.

Reveal: file → `loadForDecoding` → `decode` (as received, then rescaled to likely original sizes) → CRC → text, or locked → passcode → text.

## Configuration

Every limit and parameter is in `src/config.ts`: payload limits, image sizes and quality, embedding coefficients, strengths and repeats, self-test qualities, KDF parameters, timeouts.

## Service worker

`public/sw.js` caches the app shell only (the list is written at build time), so the app opens offline. It handles the share-target POST by holding the file in memory and handing it to the page once. It never writes a photo or a message to Cache Storage, IndexedDB or any other store.

## Security headers

`public/_headers` sets a restrictive Content Security Policy (`default-src 'none'`, scripts, styles, images, connections and workers from the same origin only; images from `blob:`), no referrer, no framing. The end-to-end test runs the app under these headers and fails on any violation.

## Known engineering limits

* Encoding and decoding run on the main thread. The page can feel busy for a second or two on older phones. Moving the engine into a Web Worker is straightforward because it is DOM-free, and is on the roadmap.
* The format needs the 8×8 grid intact. Crops that move the grid break it. Rescales are handled by the decoder's size guesses, not by true registration.
