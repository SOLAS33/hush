# Technical Design Brief & Implementation Plan
## WhatsApp Image Steganography PWA — Prototype v1.0

*Filed as received from the owner on 20 October 2026. The product was named Hush. Nothing below has been changed.*

**Project type:** Personal / open-source-style technical prototype  
**Distribution:** Free public access, hosted on the owner's website  
**Target platforms:** iPhone and Android  
**Primary communication channel:** WhatsApp  
**Application type:** Installable Progressive Web App (PWA)  
**Backend:** None required for message processing  
**Primary objective:** Hide short text messages inside ordinary photographs, share them through WhatsApp, and recover them through a simple, temporary extraction interface.

---

## 1. Project objectives

Build a mobile-first web application that lets users embed short text messages into photographs and recover those messages after the photographs have been sent through WhatsApp.

The application must prioritise:

1. Ease of use.
2. Recovery of messages after WhatsApp image processing.
3. Minimal visual changes to the photograph.
4. No intentional retention of decoded messages or selected photographs.
5. Optional passcode-based encryption.
6. Compatibility with current iOS and Android browsers.
7. Free hosting and operation without user accounts.

The application is a prototype. The developer must validate technical feasibility experimentally rather than assume that any particular image-encoding algorithm will survive WhatsApp processing.

### 1.1 Agreed product behaviour

- Users can take a photograph using their phone or select an existing image.
- Users can enter a short hidden text message.
- The app embeds the message and produces a new image.
- The app hands the encoded image to the phone's normal sharing interface.
- The sender chooses WhatsApp, selects a recipient and adds an ordinary WhatsApp caption manually.
- The recipient shares the received image into the PWA or selects it through the PWA's image picker.
- The app automatically attempts extraction.
- An unencrypted message is displayed immediately when successfully recovered.
- An encrypted message requires a passcode.
- The viewer does not maintain a message history.
- Closing the viewer clears the decoded message from the app's active state.
- All encoding, decoding and encryption operations occur locally on the device.

The application must not require a WhatsApp API integration, WhatsApp account credentials or automated sending.

---

## 2. Scope and exclusions

### Included in version 1

- Installable PWA.
- Mobile-first user interface.
- Camera capture and photo selection.
- Text message composition.
- Image encoding and decoding.
- WhatsApp sharing through the operating system's share sheet.
- Optional passcode encryption.
- Temporary extraction viewer.
- Error handling and image compatibility testing.
- Static website deployment over HTTPS.
- Automated unit, integration and device compatibility tests.

### Explicitly excluded from version 1

- User accounts or registration.
- Server-side message storage.
- Message history or contact lists.
- Cloud image processing.
- Direct WhatsApp API integration.
- Automated recipient selection or message sending.
- Synchronisation between devices.
- Group messaging features.
- Large file or document embedding.
- Claims of forensic invisibility or guaranteed undetectability.
- Guaranteed recovery after screenshots, arbitrary image editing or every possible social media transformation.

---

## 3. Proposed technical stack

Use a small TypeScript application with a modern frontend build system.

| Component | Preferred implementation |
|---|---|
| Language | TypeScript |
| UI framework | React |
| Build tooling | Vite |
| PWA support | Web App Manifest and service worker |
| Styling | Responsive CSS |
| Image processing | Browser Canvas/ImageBitmap APIs, with a suitable image-processing library if required |
| Binary payload format | Versioned, documented binary format |
| Encryption | Web Crypto API |
| Password-based key derivation | PBKDF2 initially, or Argon2id if a vetted browser-compatible implementation is justified |
| Error correction | Established Reed–Solomon, BCH or comparable code selected after testing |
| Sharing | Web Share API and `navigator.canShare()` |
| Receiving shared files | Web Share Target API where supported |
| Testing | Vitest and Playwright, supplemented by physical-device tests |
| Hosting | Static HTTPS hosting on the owner's domain |
| Backend | None for application processing |

The agent may substitute equivalent technologies where necessary, but must document the reason for each substitution.

Use maintained dependencies, pin versions and provide a lockfile. Do not implement custom cryptographic primitives.

---

## 4. Architecture

Separate the project into five modules.

### 4.1 User interface

Responsibilities:

- Home screen.
- Create-message screen.
- Photo capture and selection.
- Text entry.
- Encryption toggle and passcode entry.
- Share action.
- Image selection for extraction.
- Temporary message viewer.
- Error and compatibility messages.

The UI must not contain image-encoding or cryptographic algorithms directly.

### 4.2 Image processing module

Responsibilities:

- Load and validate images.
- Determine dimensions and supported format.
- Produce a normalised working representation when required.
- Invoke the selected embedding or extraction algorithm.
- Return a generated image or decoded payload.
- Release large image buffers and temporary object URLs when no longer needed.

### 4.3 Payload module

Responsibilities:

- Encode text using UTF-8.
- Define payload structure and versioning.
- Include message length and required flags.
- Validate payload integrity.
- Distinguish ordinary images from images containing a supported payload.

### 4.4 Cryptography module

Responsibilities:

- Generate random salts and nonces.
- Derive keys from user passcodes.
- Encrypt and authenticate message payloads.
- Decrypt and authenticate payloads.
- Return a generic failure for an incorrect passcode or invalid authentication tag.

### 4.5 Platform integration module

Responsibilities:

- Camera and photo-picker access.
- Sharing generated images.
- Receiving shared images where supported.
- Handling cancellation and unsupported browser APIs.
- Providing manual image-selection fallbacks.

No module may send the image, plaintext message, passcode or encryption key to a server.

---

## 5. Image encoding: critical technical requirement

This is the highest-risk component of the project.

Traditional least-significant-bit pixel encoding must not be treated as the final solution. It is too fragile when image dimensions, colour values or compression change.

The selected algorithm must be designed to tolerate lossy image processing, particularly JPEG recompression and resizing.

### 5.1 Candidate techniques

The agent should investigate at least two candidate approaches:

1. Frequency-domain encoding based on suitable JPEG/DCT coefficients.
2. A robust image-steganography implementation or research-derived technique designed to survive lossy recompression.

Investigate the use of error-correcting codes, spatial distribution of payload bits and synchronisation markers.

Do not assume that simply adding Reed–Solomon coding to a fragile pixel-level method will make it WhatsApp-compatible.

A relevant starting point is the research paper *Robust image steganography against JPEG compression based on DCT residual modulation*, published in Signal Processing in 2024. The agent should assess whether its approach can be implemented practically in a browser, rather than assuming the paper supplies a ready-to-use JavaScript library.

Reference: https://doi.org/10.1016/j.sigpro.2024.109431

### 5.2 Algorithm selection gate

Before developing the complete PWA, implement a standalone encoder/decoder prototype.

Compare the candidate techniques using:

- Exact message recovery rate.
- JPEG recompression tolerance.
- Resizing tolerance.
- Visual image quality.
- Supported image dimensions.
- Maximum reliable payload size.
- Encoding and decoding time on mobile devices.
- Complexity and suitability for browser implementation.
- Availability and licence of any third-party implementation.

Record the results in a short technical report.

**Do not proceed to full UI development until at least one candidate demonstrates reliable recovery through actual WhatsApp transfers on both iOS and Android.**

If no candidate passes, report the limitation and recommend the next experiment instead of silently weakening the requirement.

### 5.3 Provisional image parameters

These are initial engineering targets, not proven guarantees.

| Parameter | Initial target |
|---|---|
| Primary input | Phone photograph |
| Accepted input | JPEG, PNG, WebP where browser decoding supports it |
| Preferred working resolution | Preserve source resolution where practical |
| Minimum working dimensions | Start testing at 1024 × 1024 pixels |
| Recommended image | Detailed photograph with natural texture |
| Initial payload target | Up to 240 UTF-8 bytes |
| Hard payload limit | 512 UTF-8 bytes, subject to proven algorithm capacity |
| Initial target message | One or two short lines |
| Output | Encoded image in a supported sharing format |
| Recovery requirement | Exact text recovery or an explicit failure |
| Unsupported transformation | Reported honestly, never treated as successful recovery |

The payload size limits must be adjustable through a central configuration file. Do not hardcode these values across multiple modules.

The agent must determine whether a particular output format is retained by WhatsApp or converted during sharing. Do not assume that PNG output will remain PNG.

### 5.4 Payload format

Create a documented, versioned binary payload format.

At minimum, it should define:

- Format identifier or synchronisation marker.
- Format version.
- Flags indicating encryption and payload type.
- Payload length.
- Payload bytes.
- Integrity or error-detection information where appropriate.

The embedding algorithm must also include whatever framing and redundancy it needs for reliable detection and extraction.

Do not expose a conspicuous text marker or metadata field that directly announces the existence of a hidden message. Do not rely on image metadata or bytes appended after the image as the primary embedding technique.

### 5.5 Image quality

The application should avoid obvious visual artefacts.

Evaluate the original and encoded image using:

- SSIM or another suitable image-quality metric.
- PSNR as a supplementary metric.
- Visual inspection at normal display size and at enlarged detail.
- Statistical detectability testing where practical.

Set provisional visual-quality targets after measuring baseline results. Do not claim that an image is undetectable simply because the changes cannot be seen by eye.

---

## 6. Message encryption

Encryption is optional and disabled by default.

When disabled, the message is embedded as plaintext within the payload. When enabled, the message is encrypted before embedding.

### 6.1 Cryptographic requirements

Use a vetted authenticated encryption implementation, preferably AES-256-GCM through the Web Crypto API.

For passcode-derived keys:

- Generate a cryptographically random salt for each message.
- Use a password-based key derivation function.
- Generate a fresh, unique nonce for every encryption operation.
- Store the salt, nonce and necessary parameters in the encrypted payload header.
- Authenticate the encrypted content and relevant header fields.
- Never store or transmit the passcode.
- Never reuse a nonce with the same key.
- Reject invalid authentication tags.

PBKDF2-HMAC-SHA-256 is a practical initial browser-native option. Configure its iteration count based on current security guidance and measured performance on supported mobile devices. Document the chosen value and make it versioned. If using Argon2id instead, use a vetted implementation and benchmark its memory requirements.

### 6.2 Passcode parameters

- No passcode prompt for unencrypted messages.
- Encrypted messages prompt for the passcode after successful extraction.
- Allow a configurable passcode length with a sensible minimum.
- Encourage long passphrases rather than relying exclusively on short numeric PINs.
- Do not store passcodes in browser storage, application state beyond necessity, or logs.
- On incorrect passcode, display a generic message such as “Unable to unlock message.”
- Clear passcode input and derived key material as soon as reasonably possible after use.

A browser cannot guarantee forensic erasure of every memory copy. The application must minimise retention and clear references promptly.

### 6.3 Payload overhead

Encryption introduces salt, nonce, authentication tag and framing overhead. Error correction introduces additional overhead.

The encoder must calculate the effective payload size before embedding and warn the user when the message will not fit.

The agent must test whether encryption affects recovery rates and image quality. It must not assume that an encrypted payload will fit whenever an unencrypted payload does.

---

## 7. User interface specification

Keep the interface intentionally minimal.

### 7.1 Home screen

Display two primary actions:

- **Create message**
- **Reveal message**

Include a short privacy statement: “Messages are processed on your device. The app does not keep a message history.”

### 7.2 Create message

Workflow:

1. Select “Create message.”
2. Choose “Take photo” or “Choose photo.”
3. Enter a hidden message.
4. Optionally enable “Protect with passcode.”
5. If enabled, enter and confirm the passcode.
6. Run the encoder.
7. Display the resulting image preview and a “Share image” button.
8. Invoke the system share sheet.
9. The user chooses WhatsApp, recipient and visible caption within WhatsApp.

The PWA must not attempt to set the WhatsApp caption or recipient automatically in version 1.

If sharing fails or is cancelled, preserve the current draft only in active memory while the user remains in the creation workflow. Provide an explicit discard action.

### 7.3 Reveal message

Support two routes:

- Share an image from another app into the PWA, where the installed PWA can receive shared files.
- Open the PWA and select a photo through the system photo picker.

After a valid image is selected:

1. Attempt extraction automatically.
2. Validate the payload.
3. If plaintext, display the recovered message.
4. If encrypted, request the passcode and decrypt locally.
5. If no payload is found, display “No supported hidden message found.”
6. If the image is damaged or the payload cannot be recovered, display “Unable to recover message.”

Do not display partial or corrupted plaintext as a successful result.

### 7.4 Temporary message viewer

The viewer should display only:

- The recovered text.
- A “Done” button.

Do not display the original image, filename, sender, timestamp or message history.

On “Done,” clear the decoded text, passcode input, active payload references and temporary image references, then return to the neutral home screen.

Also clear active state when the viewer is reset or the application navigates away where practical. Do not promise that every browser or operating-system memory copy is erased.

Do not add automatic disappearance timers in the first release. Explicit dismissal is easier to test and avoids unexpectedly removing a message while the user is reading it.

---

## 8. WhatsApp sharing and PWA integration

### 8.1 Outbound sharing

Use the Web Share API where supported.

- Create an image `File` from the encoder output.
- Check `navigator.canShare({ files: [...] })` before attempting file sharing.
- Invoke `navigator.share()` only in response to a direct user action.
- Handle cancellation and errors.
- Do not assume the share sheet will always include WhatsApp.
- Do not assume WhatsApp preserves the output file's encoding.
- Do not require the user to log in to a service.

If direct sharing is unavailable, offer a download/save-image fallback with clear instructions for sharing the image through WhatsApp.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API

### 8.2 Inbound sharing

Implement the Web Share Target API as a progressive enhancement.

Where supported, configure the PWA manifest to accept image files through a POST share target. Use a service-worker handler if required by the chosen implementation.

Important constraints:

- Share-target support differs between browsers.
- The PWA must be installed to appear as a share target.
- Safari on iOS must not be assumed to support the same inbound sharing workflow as Chromium-based Android browsers.
- Incoming shared data must be validated.
- Avoid putting image data or decoded messages in URLs.
- Avoid persisting shared files to IndexedDB or Cache Storage merely to transfer them between app contexts.
- If a browser requires temporary storage to implement the share-target handoff, isolate it, minimise its lifetime and document the limitation.

Reference: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target

### 8.3 Required fallback

The app must remain usable without inbound share-target support.

The universal fallback is:

1. Open the PWA.
2. Tap “Reveal message.”
3. Choose the received image through the photo picker.
4. Extract and display the message.

The agent must test both iOS Safari and Android Chrome on physical devices.

---

## 9. Privacy and data-retention requirements

The PWA must operate without a backend for message handling.

### Required controls

- No user registration.
- No application database.
- No server-side image processing.
- No server-side storage of messages.
- No analytics containing message or image information.
- No third-party advertising or tracking scripts.
- No plaintext, passcodes, keys or payload bytes in console logs.
- No image or message content in URLs.
- No persistence of decoded messages in local storage, session storage, IndexedDB or Cache Storage.
- No message history.
- No automatic export of extracted messages.
- No clipboard copying unless explicitly requested by the user.
- Clear temporary object URLs and image buffers when finished.
- Minimise the lifetime of decoded text and encryption keys in memory.
- Use a restrictive Content Security Policy.
- Use HTTPS for all application access.

A service worker may cache the application shell to enable PWA installation and faster loading, but must not cache user photographs, encoded outputs or extracted content.

Review service-worker routes, error reporting and browser storage during privacy testing. Be aware that the browser, operating system, photo library, WhatsApp and backups remain outside the application's full control.

---

## 10. Error handling

Implement distinct, user-friendly errors for:

- Unsupported image format.
- Image too small or unsuitable.
- Message exceeds capacity.
- Encoding failure.
- Sharing unsupported.
- Share cancelled.
- No payload detected.
- Payload corruption.
- Unsupported payload version.
- Passcode incorrect or authentication failed.
- Image-processing timeout.
- Insufficient memory or device resources.

Errors must not reveal sensitive message contents or include image data in diagnostics.

Use generic decryption errors so the interface does not distinguish between an incorrect passcode and a tampered encrypted payload.

---

## 11. Testing plan

### Phase A — Encoding prototype

Create a command-line or browser-based test harness that can:

- Encode a short message into a source photograph.
- Decode the resulting image locally.
- Generate a test report.
- Compare recovered text byte-for-byte against the original.
- Measure image-quality changes.
- Test multiple image dimensions and payload lengths.

Start with synthetic test images and real phone photographs.

### Phase B — WhatsApp round-trip testing

Use consenting test accounts and devices.

For each test:

1. Capture a source photograph.
2. Encode a known message.
3. Share the image through WhatsApp using the intended normal-photo workflow.
4. Receive the image on another device.
5. Obtain the actual received image file.
6. Run the decoder.
7. Compare the recovered payload against the original.
8. Record dimensions, file format, file size and recovery result.

Test separately on iOS and Android. Also test different image sizes and multiple sharing sessions.

Where feasible, compare normal photo sending with sending as a document, but do not treat document sending as the primary success path.

Do not use a screenshot as the only test. Screenshots introduce a different image transformation.

### Phase C — Encryption tests

Verify:

- Correct passcode decrypts successfully.
- Incorrect passcode fails.
- Altered ciphertext fails authentication.
- Altered nonce, salt or header is rejected.
- Fresh encryption produces fresh random parameters.
- Passcodes and plaintext are absent from persistent storage and logs.
- Encrypted messages can be extracted after WhatsApp processing.

### Phase D — PWA tests

Test:

- Installation and launch.
- Camera permission acceptance and denial.
- Photo picker.
- Outbound image sharing.
- Inbound share-target support where available.
- Manual extraction fallback.
- App dismissal and state clearing.
- Offline launch of the application shell.
- Browser refresh and navigation.
- Mobile layout and accessibility.
- Large image handling.

### Phase E — Device matrix

Minimum initial matrix:

| Platform | Browser | Required tests |
|---|---|---|
| iPhone | Safari | Capture, encode, share, receive, decode |
| iPhone | Installed PWA | Installation, launch, extraction, state clearing |
| Android | Chrome | Capture, encode, share, receive, decode |
| Android | Installed PWA | Installation, inbound share where supported, fallback picker |

Record the actual OS and browser versions used. Add more browsers only after the primary workflows are reliable.

---

## 12. Acceptance criteria

Version 1 is acceptable when all of the following are demonstrated:

1. A user can embed and locally recover a short message without WhatsApp.
2. The selected algorithm can recover messages after real WhatsApp image transfers on both iOS and Android.
3. Recovery tests report exact payload equality, not just visually plausible text.
4. The target message length is achieved at the documented image dimensions and processing conditions.
5. The encoded image remains visually acceptable under the agreed quality tests.
6. Optional encryption works correctly and fails safely with an incorrect passcode.
7. The application works without an account or backend.
8. The main workflows work on current iPhone Safari and Android Chrome.
9. Unsupported direct sharing has a clear fallback.
10. The PWA does not intentionally retain message history or user image content.
11. Decoded messages are removed from active UI state when dismissed.
12. The application can be hosted as static HTTPS content.
13. Dependencies and their licences are documented.
14. Known limitations are documented before public release.

Set numerical reliability targets after the first round-trip experiments. Do not invent a success rate before collecting test data.

---

## 13. Implementation sequence for the coding agent

### Milestone 1 — Research and feasibility

- Review robust image-steganography approaches.
- Identify suitable libraries, implementation constraints and licences.
- Build a minimal encoder/decoder harness.
- Run WhatsApp round-trip experiments.
- Document findings and recommend the selected algorithm.

**Deliverable:** feasibility report, candidate comparison, test harness and recommendation.

### Milestone 2 — Core encoding library

- Implement the selected embedding algorithm.
- Implement payload framing and versioning.
- Implement error correction and payload validation.
- Add deterministic unit tests.
- Add image-quality measurements.
- Document supported formats and limitations.

**Deliverable:** independently testable encoding and decoding module.

### Milestone 3 — Encryption

- Add passcode-based encryption.
- Implement key derivation, salt and nonce handling.
- Add authentication and failure handling.
- Add tests for tampering and incorrect passcodes.

**Deliverable:** tested optional encryption module.

### Milestone 4 — PWA interface

- Implement the home screen.
- Implement camera and photo selection.
- Implement the message composer.
- Implement the encoded-image preview and sharing action.
- Implement automatic extraction and temporary viewer.
- Implement state clearing and error handling.

**Deliverable:** functional local application.

### Milestone 5 — Platform integration

- Implement outbound sharing.
- Implement inbound share target where supported.
- Implement the universal photo-picker fallback.
- Test on physical iPhone and Android devices.
- Document differences in platform behaviour.

**Deliverable:** tested mobile workflows.

### Milestone 6 — Privacy, testing and deployment

- Audit storage, caching, logs and external network requests.
- Complete the device matrix.
- Finalise compatibility documentation.
- Configure HTTPS hosting.
- Add PWA icons, manifest and service worker.
- Produce deployment and maintenance instructions.

**Deliverable:** deployable prototype with documented limitations.

---

## 14. Required repository structure

Use a structure similar to the following, adapting it if the chosen image-processing library requires a different layout.

```text
whatsapp-steg-pwa/
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── app/
│   ├── components/
│   ├── pages/
│   ├── image/
│   │   ├── encoder.ts
│   │   ├── decoder.ts
│   │   └── image-utils.ts
│   ├── payload/
│   │   ├── format.ts
│   │   └── validation.ts
│   ├── crypto/
│   │   ├── encrypt.ts
│   │   └── decrypt.ts
│   ├── platform/
│   │   ├── share-out.ts
│   │   └── share-in.ts
│   ├── privacy/
│   │   └── cleanup.ts
│   └── config.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── architecture.md
│   ├── algorithm-evaluation.md
│   ├── device-test-matrix.md
│   └── deployment.md
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

The filenames are suggestions. Maintain clear module boundaries and avoid building a monolithic component.

---

## 15. Instructions to the coding agent

Implement this project incrementally. Do not generate the entire application in one untested step.

Before selecting the encoding algorithm, provide a short technical assessment identifying the candidate approaches and their likely browser implementation constraints.

Prioritise a working WhatsApp round trip over visual polish.

Use documented, established cryptographic primitives. Do not create a custom cipher or claim that steganography provides encryption.

Do not assume that iOS and Android support the same inbound or outbound PWA sharing capabilities. Use feature detection and provide fallbacks.

Do not introduce a backend, database, analytics service or user account system unless the owner explicitly approves a future change to scope.

Keep all configurable parameters in one documented configuration module, including payload limits, image constraints, encryption settings and timeouts.

Add automated tests for each module and maintain a clear record of known limitations.

If the encoding algorithm cannot meet the reliability requirement, stop at the feasibility milestone and report the results. Do not silently substitute fragile encoding while describing the product as WhatsApp-compatible.

At the end of each milestone, report:
- Files created or changed.
- Tests run and their results.
- Remaining technical risks.
- Manual device tests still required.
- The next recommended milestone.

## 16. Final definition of success

The project succeeds when a user can take a normal photograph, embed a short message, share it through WhatsApp with an ordinary caption, and have another user recover the exact hidden message through the PWA without maintaining a message history.

The primary engineering challenge is reliable extraction after WhatsApp processes the image. Everything else should be designed around keeping that workflow simple, local, private and maintainable.
