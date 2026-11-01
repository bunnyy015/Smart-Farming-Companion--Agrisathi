/* global importScripts, firebase */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || "/")
  );
});

importScripts(
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyBCjxr0RhcoiD8DPo7aamj87Lsq_ekkmBg",
  authDomain: "agrisathi-a84f8.firebaseapp.com",
  databaseURL:
    "https://agrisathi-a84f8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agrisathi-a84f8",
  storageBucket: "agrisathi-a84f8.firebasestorage.app",
  messagingSenderId: "276498360495",
  appId: "1:276498360495:web:b224d637f670a3bf67cc5a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "AgriSaathi";
  const options = {
    body: payload.notification?.body || payload.data?.body || "You have a new notification.",
    icon: "/agrisathi-logo.png",
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});
