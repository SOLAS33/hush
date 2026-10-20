# Algorithm evaluation (feasibility report)

This is the report the design brief asks for in section 5.2. It records what was built, what was measured, and what has **not** been measured.

## Short version

* Plain pixel-level embedding (least significant bit) does not survive any JPEG compression, even at quality 100. Rejected, as the brief expected.
* A frequency-domain method (quantisation-index modulation of mid-frequency 8×8 DCT coefficients, spread over the whole image, soft-vote decoding, Reed-Solomon error correction) recovers messages exactly through JPEG recompression down to quality 40 and below, at the strengths the app uses, in simulation and in real Chrome.
* **Not yet tested: real WhatsApp transfers on iPhone and Android.** The brief's gate ("do not proceed to full UI development until at least one candidate demonstrates reliable recovery through actual WhatsApp transfers") has not been met. The owner chose to publish the prototype first so that this test can be run on real phones. Until it passes, the product must not be described as WhatsApp-compatible. The app says "prototype" on every screen.

## Candidates

| | A. Pixel LSB + Reed-Solomon | B. DCT QIM, spread + soft vote + Reed-Solomon (built) | C. DCT residual modulation (Signal Processing, 2024) |
|---|---|---|---|
| Basis | Low bit of blue channel, keyed random positions, repeated | Mid-frequency 8×8 luma DCT coefficients moved onto a lattice finer than JPEG's own quantiser step | Published research method, designed for JPEG robustness |
| Built here | Yes (`tools/baseline-lsb.ts`) | Yes (`src/image/embed-core.ts`) | No. Assessed from the paper only |
| Survives JPEG | **No**, fails at quality 100, 95, 92, 80, 60 | **Yes**, see tables | Reported to |
| Browser implementation | Trivial | Plain TypeScript, no dependencies, about 300 lines | Not assessed in code. The paper supplies no JavaScript library, and the method works on JPEG coefficients in a way that suits a decoder-level library more than the canvas pixels a browser gives us |
| Licence | Ours | Ours (MIT) | Paper only; no implementation to reuse |

Candidate C was not built because candidate B met the survival target in simulation, and building a second robust method would not have changed the decision. It remains the next thing to try if B fails in real WhatsApp transfers.

## How B works, and why it should survive

JPEG compresses an image by splitting it into 8×8 blocks, taking each block's DCT, and rounding every coefficient to a multiple of a fixed step (the quantiser). Recompression rounds the same coefficients again. Hush picks five mid-frequency coefficients per block, where the standard luma steps are small (about 13 to 19 at quality 50, less at higher quality), and moves each onto one of two interleaved lattices with a larger step Δ. The bit is which lattice it sits on. Recompression moves a coefficient by at most half JPEG's step, which is less than the gap between the lattices, so the bit survives.

* **Spreading:** every bit is written into many coefficients at keyed random positions across the whole image, then decided by a soft vote. This averages out clipping, rounding and local damage.
* **Per-position weighting:** the header is known once it decodes, so the decoder measures how reliable each of the five coefficient positions was and weights the body vote by it. This fixed several partial failures in testing.
* **Error correction:** Reed-Solomon over GF(256), 16 to 64 parity bytes per block.
* **Strength is not stored.** The decoder tries each Δ in `CONFIG.embed.steps` until a header decodes with a valid check byte.
* **Self-test:** the encoder rehearses recompression at JPEG qualities 42, 50, 60, 70 and 80 on the phone and keeps the weakest Δ that passes all of them. Recovery is not monotonic in quality (a Δ can pass at 50 and fail at 60 when JPEG's step lines up badly with the lattice), so several in-between values are tested.
* **Rescaling:** if the messenger shrinks the photo, the decoder rescales it back to each likely original size (`CONFIG.embed.rescaleLongEdges`) and retries. In tests this recovers photos shrunk to 800 pixels wide, but only at the stronger Δ values. The encoder keeps the shared photo at 1280 pixels or less so a messenger has little reason to rescale.

## Measured results (synthetic photographs, libjpeg via sharp)

Source: `docs/robustness-report.csv`, produced by `npm run report`. 240-byte message, 4:2:0 chroma subsampling. Y means the exact message was recovered, c means the error correction gave up, n means no header was found.

| Image | Δ | PSNR dB | SSIM | q92 | q80 | q70 | q60 | q50 | q40 | q30 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1280×960 | 20 | 43.9 | 0.970 | Y | Y | Y | Y | Y | Y | n |
| 1280×960 | 28 | 41.1 | 0.944 | Y | Y | Y | Y | Y | Y | Y |
| 1280×960 | 38 | 38.4 | 0.902 | Y | Y | Y | Y | Y | Y | Y |
| 1280×960 | 52 | 35.7 | 0.833 | Y | Y | Y | Y | Y | Y | Y |
| 1024×768 | 28 | 41.0 | 0.943 | Y | Y | Y | **c** | Y | Y | Y |
| 1024×768 | 38 | 38.4 | 0.901 | Y | Y | Y | Y | Y | **c** | Y |
| 800×600 | 20 | 43.9 | 0.970 | Y | Y | Y | Y | **c** | **c** | n |
| 800×600 | 38 | 38.4 | 0.902 | Y | Y | Y | Y | Y | Y | Y |

Observations:

* Larger Δ costs picture quality but survives harder compression. The synthetic test image is deliberately busy, so its SSIM is lower than a typical photo's at the same Δ.
* Failures are patchy, not a clean threshold. This is the reason for the multi-quality self-test.
* Smaller images and longer messages have less redundancy and fail sooner. The report CSV also covers 60-byte and 400-byte messages.
* Full-flow tests (`tests/integration`) pass for plain text, passcode text, portrait photos, shrinking to 1152 and 1024 pixels, and "no message in an ordinary photo".
* A real Chrome run (`npm run test:e2e`) hides a message in the built app using Chrome's own canvas JPEG encoder, recompresses with libjpeg at 80, 65 and 50, and reveals it exactly, 19 checks in all.

## Capacity and speed

* Capacity is computed from the image: `blocks × 5` slots, minus the header, at least 4 repeats per body bit. A 1280×960 photo can hold about 2,100 body bytes, 800×600 about 790 and 640×480 about 470, so on large photos the 512-byte hard limit is what binds. The soft limit of 240 and hard limit of 512 bytes are in `src/config.ts`.
* Encryption adds 45 bytes (key id, salt, nonce, tag) and the body CRC adds 4.
* Time: embedding or reading takes about 50 to 100 ms for a 1280×960 image in Node. The self-test repeats it with up to five JPEG round trips per strength; expect a few seconds on a phone. Not yet measured on a phone.

## Not measured, and why

* **WhatsApp itself** (iOS and Android, normal photo and HD, different phones). This needs real devices and accounts. See [device-test-matrix.md](device-test-matrix.md).
* **Real photographs.** Tests use generated images with natural-looking texture. Real phone photos should be added as fixtures once the owner supplies some.
* **Statistical detectability.** Not tested. Do not claim undetectability.
* **Time on phones.**

## If real WhatsApp transfers fail

Likely causes, in order: WhatsApp rescales to a size the decoder does not try; its JPEG quality is lower than 40; it applies colour or sharpening changes; or it crops. The recorded size, type and file size shown under "Technical details" on a failed Reveal are meant to answer this. Next experiments: raise the strongest Δ; add more candidate rescale sizes; test sending as a document; then candidate C.
