import { doc, getDoc, setDoc, deleteField } from "firebase/firestore";
import { db } from "./firebase";

let currentUid = null;

export function setStorageUser(uid) {
  currentUid = uid;
}

function ref() {
  if (!currentUid) throw new Error("Not signed in yet");
  return doc(db, "budgetLedgers", currentUid);
}

// Same shape as Claude's artifact `window.storage` API, backed by one
// Firestore document per signed-in user. Every key from the app (wallets,
// fixed-payments, payment-log, etc.) becomes a field on that document.
window.storage = {
  async get(key) {
    const snap = await getDoc(ref());
    const data = snap.exists() ? snap.data() : {};
    if (!(key in data)) throw new Error("not found");
    return { key, value: data[key], shared: false };
  },
  async set(key, value) {
    await setDoc(ref(), { [key]: value }, { merge: true });
    return { key, value, shared: false };
  },
  async delete(key) {
    await setDoc(ref(), { [key]: deleteField() }, { merge: true });
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "") {
    const snap = await getDoc(ref());
    const data = snap.exists() ? snap.data() : {};
    const keys = Object.keys(data).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};
