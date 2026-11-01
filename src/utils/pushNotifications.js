import { database, getAuthUser, getMessagingInstance, firebaseVapidKey } from "../firebase";
import { ref, set } from "firebase/database";

const ERROR_MESSAGES = {
  unsupported: "This browser does not support web push notifications. Use the latest Chrome on Android or a supported desktop browser.",
  insecure: "Push notifications require a secure HTTPS page. On your phone, use an HTTPS URL; the computer's localhost does not make its local IP secure.",
  serviceWorker: "This browser cannot register service workers. Update Chrome or open the app in a supported browser.",
  messaging: "Firebase Messaging could not initialize. Check that the Firebase Messaging service is enabled for this project and reload the app.",
  notSignedIn: "Sign in to AgriSaathi before enabling notifications.",
  permissionDenied: "Notification permission is blocked. Allow notifications for this site in Chrome's site settings, then try again.",
  vapidMissing: "The Firebase Web Push certificate key is missing. Copy the public key from Firebase Console → Project settings → Cloud Messaging → Web Push certificates into firebaseVapidKey in src/firebase.js.",
  serviceWorkerRegistration: "The notification service worker could not be installed. Open /firebase-messaging-sw.js on this same HTTPS site and check for a load or JavaScript error.",
  token: "Firebase did not return a push token. Check the Web Push certificate key and Firebase Messaging setup.",
  database: "The push token was obtained, but Firebase Realtime Database rejected saving it. Check the notificationTokens rules for this signed-in account.",
  generic: "Push notification registration failed. Check your connection and browser permissions, then try again.",
};

function failure(reason, cause) {
  return { success: false, reason, message: ERROR_MESSAGES[reason] || ERROR_MESSAGES.generic, cause };
}

export async function registerForPushNotifications() {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !("Notification" in window)) {
      return failure("unsupported");
    }
    if (!window.isSecureContext) return failure("insecure");
    if (!("serviceWorker" in navigator)) return failure("serviceWorker");

    const { getToken, isSupported } = await import("firebase/messaging");
    let supported;
    try {
      supported = await isSupported();
    } catch (error) {
      return failure("unsupported", error);
    }
    if (!supported) return failure("unsupported");

    const user = await getAuthUser();
    if (!user) return failure("notSignedIn");
    if (!firebaseVapidKey) return failure("vapidMissing");

    let messagingInstance;
    try {
      messagingInstance = await getMessagingInstance();
    } catch (error) {
      return failure("messaging", error);
    }
    if (!messagingInstance) return failure("unsupported");

    let registration;
    try {
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await navigator.serviceWorker.ready;
    } catch (error) {
      return failure("serviceWorkerRegistration", error);
    }

    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return failure("permissionDenied");

    let token;
    try {
      token = await getToken(messagingInstance, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch (error) {
      return failure("token", error);
    }
    if (!token) return failure("token");

    // Keep the existing stable database key scheme so repeated registration
    // updates this device's existing record instead of creating duplicates.
    const tokenKey = btoa(token)
      .replace(/[.#$]/g, "_")
      .replaceAll("/", "_")
      .replaceAll("[", "_")
      .replaceAll("]", "_");
    try {
      await set(ref(database, `notificationTokens/${user.uid}/${tokenKey}`), {
        token,
        updatedAt: Date.now(),
      });
    } catch (error) {
      return failure("database", error);
    }

    return { success: true };
  } catch (error) {
    const reason = error?.code === "messaging/permission-blocked"
      ? "permissionDenied"
      : error?.code === "messaging/unsupported-browser"
        ? "unsupported"
        : "generic";
    console.warn("Push notification registration failed:", error?.code || error?.message || "unknown error");
    return failure(reason, error);
  }
}
