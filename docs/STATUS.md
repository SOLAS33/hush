# Status, known limits and next steps

Written 20 October 2026, updated for version 1.0 (complete interface, install guide, full browser test suite).

## Where it stands

| Brief milestone | State |
|---|---|
| 1. Research and feasibility | Done for candidates A (rejected) and B (works in simulation and real Chrome). Candidate C assessed on paper only. Real WhatsApp round trips: **not done**. See [algorithm-evaluation.md](algorithm-evaluation.md) |
| 2. Core encoding library | Done, with tests |
| 3. Encryption | Done, with tests (wrong passcode, tampered salt, nonce, tag and ciphertext, fresh parameters) |
| 4. PWA interface | Done |
| 5. Platform integration | Built: share out, share in (Android), picker fallback, download fallback. Not yet tested on a physical iPhone or Android |
| 6. Privacy, testing, deployment | Privacy audit by automated test and by design; deployed as static HTTPS; device matrix not run |

The brief says not to build the full interface before a WhatsApp round trip passes. The owner asked for the interface to be completed and published first so that the round trip can be tested on real phones. Until it passes, nothing here claims guaranteed WhatsApp compatibility: the app tests every photo before offering it, says plainly what it cannot do, and tells people to ask the receiver to confirm the first time.

## Tests that pass

* 14 unit tests: Reed-Solomon (including refusing to return wrong data), CRC, payload limits, encryption.
* 12 integration tests: engine (240 bytes after recompression at 90, 75, 60 and 50; shrink to 1152 and 1024 px; portrait; no false positive on an ordinary photo; capacity refusal; image quality) and the whole message flow with and without a passcode.
* 19 end-to-end checks (`tests/e2e/run.ts`) in real Chrome, with the real security headers: hide, messenger recompress at 80, 65, 50, reveal exactly; passcode right and wrong; ordinary photo; no storage entries; no console leakage; no CSP violations; message gone after Done.
* 55 interface checks (`tests/e2e/ui.ts`): install help for iPhone Safari, Chrome on iPhone and Android; the guide; installability reported by the browser; JPEG, PNG and WebP photos; phone-rotated photos; a 12 MP photo; a too-small photo; message and passcode limits; share-out with a mocked share sheet, a recompress, then share-in through the service worker with nothing left in storage or caches; cancelled share; no share sheet (Save image); offline use; layout and accessibility at 320, 390 and 768 px; no console errors or CSP violations.
* `tests/e2e/live.ts` walks the live path from the Solas33 products page to a finished round trip on hush.solas33.com.

## Known limits

1. Not proven through WhatsApp on any phone yet.
2. Survives JPEG recompression and, at stronger settings, shrinking. Does not survive crops, screenshots, filters, rotation by editing, or collage.
3. A very smooth photo (sky, plain wall) carries less safely. The self-test warns when a photo fails.
4. Messages are short: soft limit 240 bytes, hard limit 512. Encryption uses 45 bytes of room.
5. Not undetectable. No detectability test has been run.
6. Without a passcode the message is readable by anyone with the photo and the app. With one, it is protected by AES-256-GCM, only as strong as the passcode.
7. Encoding runs on the main thread; a self-test of up to five strengths can take several seconds on an older phone. Not yet timed on phones.
8. iPhone Safari cannot receive a shared photo into the app. Use Reveal message and the picker.
9. Tested with generated photographs, not yet a library of real phone photos.
10. If WhatsApp "HD" or "standard" quality behave differently, that is not yet known.

## Next steps

1. **Owner:** run [device-test-matrix.md](device-test-matrix.md) on one iPhone and one Android phone, and send the results back.
2. Depending on results: widen candidate rescale sizes; raise the strongest strength; or build candidate C.
3. Add real phone photos as fixtures; add a detectability measure.
4. Move the engine into a Web Worker.
5. Decide the licence (MIT for now), the product pricing (free for now), and whether the page should be indexed by search engines (it is set to noindex for now).
6. Optional: a text-size and accessibility pass with VoiceOver and TalkBack.
