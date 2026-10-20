# Device test matrix and script

This is the approval gate. Everything automated passes (see STATUS.md); what has **not** been shown is a message surviving a real WhatsApp transfer. Run this on one iPhone and one Android phone, with two consenting WhatsApp accounts, and fill in the tables. Record the actual versions.

Use the live site, https://hush.solas33.com, or a local build.

## Devices

| Role | Device | OS version | Browser and version | Installed as app? |
|---|---|---|---|---|
| iPhone sender | | | Safari | |
| iPhone receiver | | | Safari | |
| Android sender | | | Chrome | |
| Android receiver | | | Chrome | |

## A. Round trip without WhatsApp (5 minutes per phone)

1. Open Hush. Create message. Take a photo of something with texture (a bookshelf, a tree, fabric).
2. Type `Test 1 - café`. Do not set a passcode. Tap Hide message.
3. Note whether the screen says the photo passed the compression test, and how long it took.
4. Tap Share image, choose Save to Photos (iPhone) or Save (Android). Do not use WhatsApp yet.
5. Reveal message, choose the saved photo. Expected: the exact text.

## B. WhatsApp round trip (the real test)

Repeat for each case. Always send as a normal photo (not as a document), with a caption such as "Look at this".

1. Sender: Create message, hide the text, Share image, choose WhatsApp, pick the other phone, add the caption, send.
2. Receiver: open the chat, open the photo, save it to the phone (iPhone: Save to Photos; Android: the download arrow).
3. Receiver: open Hush, Reveal message, choose the saved photo.
4. Record the result. If it failed, open **Technical details** and copy the size line.

| # | Sender | Receiver | Photo | Message | Passcode | Result (exact / failed) | Received size line (if failed) | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | iPhone | Android | Detailed | 40 characters | none | | | |
| 2 | iPhone | Android | Detailed | 200 characters | none | | | |
| 3 | iPhone | Android | Detailed | 40 characters | yes | | | |
| 4 | Android | iPhone | Detailed | 40 characters | none | | | |
| 5 | Android | iPhone | Detailed | 200 characters | none | | | |
| 6 | Android | iPhone | Detailed | 40 characters | yes | | | |
| 7 | iPhone | iPhone | Smooth (sky, wall) | 40 characters | none | | | |
| 8 | Android | Android | Smooth | 40 characters | none | | | |
| 9 | either | either | Detailed, forwarded once more | 40 characters | none | | | |
| 10 | either | either | Detailed, sent as Document | 40 characters | none | | | |

Also note: does WhatsApp offer a "photo quality" setting on either phone (Settings, Storage and data, Media upload quality)? Try both Standard and HD on the first two rows.

To get the received file's size and type for the record, a failed Reveal shows them. If you can, also send the received photo to your computer and keep it: it is the best evidence of what WhatsApp did. Do not share photos with real private content.

## C. Install and app behaviour

| Check | iPhone Safari | iPhone installed app | Android Chrome | Android installed app |
|---|---|---|---|---|
| Add to Home Screen / Install works | | | | |
| Opens full screen with the Hush icon | | | | |
| Take photo opens the camera | | | | |
| Choose photo opens the photo picker | | | | |
| Share image opens the share sheet and lists WhatsApp | | | | |
| Share a photo from the Gallery or WhatsApp INTO Hush (Android only) opens Reveal | n/a | n/a | n/a | |
| Opens with no signal (airplane mode) | | | | |
| Done returns to the home screen with nothing left on screen | | | | |
| Switching to another app and back during Reveal clears the message | | | | |
| Large photo (12 MP or more) works without a crash | | | | |
| Denying camera access gives a clear path (Choose photo) | | | | |

## D. What to send back

The tables above, with versions, and for any failure the size line from Technical details. That is enough to decide: widen the rescale sizes, raise the strength, or move to the next candidate method (see [algorithm-evaluation.md](algorithm-evaluation.md)).
