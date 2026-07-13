import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Paste the config object Firebase gave you here:
// Firebase Console → Project settings → Your apps → Web app → SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2VBXTiWOXg9vFFnYhfX0JpaSUeNnGFSU",
  authDomain: "finance-e0f1b.firebaseapp.com",
  projectId: "finance-e0f1b",
  storageBucket: "finance-e0f1b.firebasestorage.app",
  messagingSenderId: "771163509437",
  appId: "1:771163509437:web:fa287fe6240d7617105dd4",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
