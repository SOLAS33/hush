/** The user guide, as data, so the in-app Guide screen and the Home steps say the same thing. Plain wording: see docs/WRITING rules in the Solas33 hub. */
export interface GuideSection {
  id: string;
  heading: string;
  intro?: string;
  steps?: string[];
  bullets?: string[];
}

export const INSTALL_IPHONE: GuideSection = {
  id: "install-iphone",
  heading: "Install on iPhone or iPad",
  intro: "Use Safari. Other browsers on iPhone cannot add the app to the Home Screen the same way.",
  steps: [
    "Open hush.solas33.com in Safari.",
    "Tap the Share button, the square with an arrow pointing up, at the bottom of the screen.",
    "Scroll down and tap Add to Home Screen.",
    "Tap Add in the top right corner.",
    "Open Hush from the new icon on your Home Screen. It opens full screen, like any other app.",
  ],
};

export const INSTALL_ANDROID: GuideSection = {
  id: "install-android",
  heading: "Install on Android",
  intro: "Use Chrome. Samsung Internet and Edge also work.",
  steps: [
    "Open hush.solas33.com in Chrome.",
    "Tap Install app on the home screen of Hush. If you do not see it, tap the three dots at the top right and choose Install app (or Add to Home screen).",
    "Tap Install to confirm.",
    "Open Hush from your app drawer or Home screen.",
    "Once installed, Hush also appears in the share list when you share a photo, so you can send a received photo straight into it.",
  ],
};

export const SEND: GuideSection = {
  id: "send",
  heading: "Send a hidden message",
  steps: [
    "Open Hush and tap Create message.",
    "Tap Take photo, or Choose photo to use one from your library. Photos with fine detail, such as trees, fabric or a crowd, work best.",
    "Type your message. The counter shows how much room you have left. About 240 characters is a good length.",
    "Optional: tick Protect with passcode, then enter and confirm a passcode of at least 8 characters. Tell the other person the passcode some way other than the photo.",
    "Tap Hide message and wait a few seconds. Hush tests the photo against repeated compression before it offers it.",
    "Tap Share image. In the share list choose WhatsApp, pick the person, and add any caption you like.",
    "Send it as a normal photo. Do not send it as a document, and do not screenshot it.",
  ],
};

export const RECEIVE: GuideSection = {
  id: "receive",
  heading: "Read a hidden message",
  steps: [
    "In WhatsApp, open the photo you received.",
    "Save it to your phone. On iPhone, tap Share then Save Image. On Android, tap the three dots then Save, or the download arrow.",
    "Open Hush and tap Reveal message.",
    "Choose the photo you just saved. Hush looks for a message straight away.",
    "If the message is locked, type the passcode and tap Unlock.",
    "Read the message, then tap Done. The message is cleared and Hush returns to the start.",
  ],
  bullets: [
    "On Android with Hush installed, you can also share the photo from WhatsApp or your gallery into Hush and skip the picker.",
    "On iPhone, sharing into the app is not available. Use Reveal message and the photo picker.",
  ],
};

export const TIPS: GuideSection = {
  id: "tips",
  heading: "Tips for reliable messages",
  bullets: [
    "Use a photo with texture. Large smooth areas, such as clear sky or a blank wall, carry a message less safely.",
    "Keep messages short. Shorter messages survive harder compression.",
    "Send the photo exactly as Hush gives it to you. Cropping, filters, editing and screenshots destroy the message.",
    "Forwarding a photo again within WhatsApp compresses it again. Messages usually survive, but ask the receiver to confirm.",
    "A message with a passcode is locked with AES-256-GCM. Without a passcode, anyone with the photo and Hush can read it.",
    "Hush does not make a photo undetectable. For anything truly secret, use an end-to-end encrypted messenger as well.",
  ],
};

export const TROUBLE: GuideSection = {
  id: "trouble",
  heading: "If something goes wrong",
  bullets: [
    "No supported hidden message found: the photo may not be a Hush photo, may have been edited or screenshotted, or may be the wrong one. Ask the sender to send it again as a normal photo.",
    "Unable to recover message: the photo was changed too much on the way. Ask for it to be sent again, or sent from a larger photo with more detail.",
    "Unable to unlock message: the passcode is wrong or the message was altered. Check upper and lower case and spaces.",
    "This photo did not pass every compression test: the message may not survive WhatsApp. Try a more detailed photo or a shorter message.",
    "Share image does nothing, or WhatsApp is not listed: use Save image, then attach the saved photo in WhatsApp as a photo.",
    "On a failed reveal, open Technical details to see the size and type of the photo you chose. Send that line to Solas33 support with a description of what happened.",
  ],
};

export const GUIDE: GuideSection[] = [INSTALL_IPHONE, INSTALL_ANDROID, SEND, RECEIVE, TIPS, TROUBLE];
