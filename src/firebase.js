import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrkUyKq08Cm5icpANDIxvrKtru_Oc3gi0",
  authDomain: "batwara-app.firebaseapp.com",
  projectId: "batwara-app",
  storageBucket: "batwara-app.firebasestorage.app",
  messagingSenderId: "102808483068",
  appId: "1:102808483068:web:58f04f602c6f7792d19379"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);