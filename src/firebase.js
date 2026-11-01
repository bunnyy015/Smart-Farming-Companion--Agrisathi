import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  initializeAuth,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBCjxr0RhcoiD8DPo7aamj87Lsq_ekkmBg",
  authDomain: "agrisathi-a84f8.firebaseapp.com",
  databaseURL:
    "https://agrisathi-a84f8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agrisathi-a84f8",
  storageBucket:
    "agrisathi-a84f8.firebasestorage.app",
  messagingSenderId: "276498360495",
  appId:
    "1:276498360495:web:b224d637f670a3bf67cc5a",
  measurementId: "G-1LML5RJV77",
};

const app = initializeApp(firebaseConfig);

// Session persistence keeps each browser tab's Firebase identity independent.
// This lets users work in different roles in separate tabs without one login
// replacing the other tab's session, while still surviving refreshes.
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
});

// currentUser remains null until Firebase finishes restoring persisted auth.
// Pages must await this before treating null as a real signed-out state.
export async function getAuthUser() {
  await auth.authStateReady();
  return auth.currentUser;
}

export const database = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");

// A VAPID public key is safe to expose in a web app. Keep the project's
// existing Firebase Console key here; it is not an Admin/server credential.
export const firebaseVapidKey =
  "BIMJJwRfsdTrVrXFaMF_ZqlDXxWPEcqHlIjoGf2xAWeAvndag5RYabdmBKiFfKoWrr21NBhkCT3fEroD92BLbSo";

// Firebase Messaging support is asynchronous and depends on browser APIs.
// Resolve it only when requested so importing this module remains SSR-safe.
let messagingPromise;
export function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        return null;
      }

      try {
        const { getMessaging, isSupported } = await import("firebase/messaging");
        if (!(await isSupported())) return null;
        return getMessaging(app);
      } catch (error) {
        console.warn("Firebase Messaging could not be initialized.", error?.code || error?.message || "unknown error");
        throw error;
      }
    })();
  }
  return messagingPromise;
}
