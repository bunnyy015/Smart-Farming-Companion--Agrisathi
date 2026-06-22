import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBCjxr0RhcoiD8DPo7aamj87Lsq_ekkmBg",
  authDomain: "agrisathi-a84f8.firebaseapp.com",
  databaseURL: "https://agrisathi-a84f8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agrisathi-a84f8",
  storageBucket: "agrisathi-a84f8.firebasestorage.app",
  messagingSenderId: "276498360495",
  appId: "1:276498360495:web:b224d637f670a3bf67cc5a",
  measurementId: "G-1LML5RJV77"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);