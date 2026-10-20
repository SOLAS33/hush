# Payload format, version 1

Nothing in the image file announces a hidden message: no text marker, no metadata, nothing appended after the image. All of it lives in the pixels.

## Layers

1. **Message.** UTF-8 text. If a passcode is set, the text is encrypted first (below).
2. **Content.** The text bytes, or the encrypted blob.
3. **Body.** `content || CRC-32(content)`, the CRC big-endian. The reader rejects the message if the CRC does not match.
4. **Header** (in the image): 4 bytes `[version<<4 | flags, length high, length low, check]` plus 8 Reed-Solomon parity bytes. `check = b0 ^ lenHi ^ lenLo ^ 0xA5`. Version is 1. Flags: bit 0 = encrypted.
5. **Body coding.** The body is split into blocks of at most 190 bytes, each protected by Reed-Solomon over GF(256) with `clamp(ceil(0.35 × block bytes), 16, 64)` parity bytes. The reader recomputes the block sizes from the length in the header.
6. **Placement.** All coded bits are XORed with a keyed pseudo-random stream (whitening), then written into mid-frequency DCT coefficients of the luma channel, 8×8 blocks, five coefficients per block ((1,2), (2,1), (2,2), (1,3), (3,1)), at keyed pseudo-random slots. The header takes the first 96 × 36 slots. The body takes the rest, each bit repeated as many times as fits.
7. **Key.** The keyed order, dither and whitening are derived from the public constant `hush/format-1` and the image's block dimensions. It is a format identifier, not a secret.

## Encrypted content

`kdfId(1) || salt(16) || nonce(12) || ciphertext || tag(16)`

* Key: PBKDF2-HMAC-SHA-256, 600,000 iterations (kdfId 1), 256-bit key, from the NFKC-normalised passcode.
* Cipher: AES-256-GCM, with additional authenticated data `[format version, kdfId]`.
* A fresh random salt and nonce are made for every message.
* Wrong passcode, changed header, changed salt, changed nonce and changed ciphertext all give the same error: "Unable to unlock message."

## Changing the format

Changing anything under `CONFIG.embed` changes what is written into images. Bump `FORMAT_VERSION` in `src/config.ts`. Old photos then report "newer version of Hush" or "no supported hidden message" rather than a wrong message. PBKDF2 iterations can change without a format bump by adding a new kdfId.
