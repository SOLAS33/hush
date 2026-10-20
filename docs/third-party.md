# Third-party software and licences

## Ships in the app

| Package | Version | Licence | Use |
|---|---|---|---|
| react | 18.3.1 | MIT | Interface |
| react-dom | 18.3.1 | MIT | Interface |

Everything else in the app is our own code: the embedding engine, Reed-Solomon, CRC-32, framing and resizing. Cryptography uses the browser's built-in Web Crypto (PBKDF2, AES-GCM). There is no custom cipher.

## Build and test only (not shipped)

| Package | Licence | Use |
|---|---|---|
| vite, @vitejs/plugin-react | MIT | Build |
| typescript | Apache-2.0 | Type checking |
| vitest | MIT | Tests |
| sharp | Apache-2.0 | libjpeg stand-in for a messenger in tests and reports; icon generation |
| puppeteer-core | Apache-2.0 | Drives the Chrome end-to-end test |
| tsx | MIT | Runs TypeScript scripts |
| @types/* | MIT | Type definitions |

## Research referenced

*Robust image steganography against JPEG compression based on DCT residual modulation*, Signal Processing, 2024, https://doi.org/10.1016/j.sigpro.2024.109431. Read as background only. No code from it is used; no implementation was found to reuse.

The Reed-Solomon coder is the standard GF(2^8) construction (polynomial 0x11d) written for this project. The JPEG standard quantisation table that motivated the choice of coefficients is public (ITU-T T.81 Annex K).
