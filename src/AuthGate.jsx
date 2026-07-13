import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { setStorageUser } from "./storage";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setStorageUser(u.uid);
    });
  }, []);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) {
    return <div style={styles.loading}>Loading…</div>;
  }

  if (!user) {
    return (
      <div style={styles.shell}>
        <div style={styles.card}>
          <h1 style={styles.title}>Budget Ledger</h1>
          <p style={styles.subtitle}>
            {mode === "signin" ? "Sign in to your ledger" : "Create your ledger account"}
          </p>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.primaryBtn} disabled={busy} onClick={submit}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            style={styles.linkBtn}
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <button style={styles.signOutFab} onClick={() => signOut(auth)}>Sign out</button>
    </>
  );
}

const styles = {
  loading: { fontFamily: "Inter, sans-serif", padding: 40, textAlign: "center", color: "#5B6660" },
  shell: {
    fontFamily: "'Inter', sans-serif", background: "#1E2A26", minHeight: "100vh",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    background: "#2A362F", borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 340,
    display: "flex", flexDirection: "column", gap: 10,
  },
  title: { fontFamily: "'Fraunces', serif", color: "#EEF0EC", fontSize: 22, margin: 0, textAlign: "center" },
  subtitle: { color: "#B9C2BC", fontSize: 13, margin: "0 0 10px", textAlign: "center" },
  input: {
    background: "#1E2A26", border: "1px solid #45524C", borderRadius: 8, color: "#EEF0EC",
    padding: "10px 12px", fontSize: 14,
  },
  error: { color: "#E39A9A", fontSize: 12.5, margin: 0 },
  primaryBtn: {
    background: "#24594A", color: "#EEF0EC", border: "none", borderRadius: 8,
    padding: "11px 0", fontSize: 14, fontWeight: 600, marginTop: 6, cursor: "pointer",
  },
  linkBtn: { background: "transparent", border: "none", color: "#7FB89F", fontSize: 12.5, cursor: "pointer" },
  signOutFab: {
    position: "fixed", bottom: 10, right: 10, background: "#1E2A26", color: "#B9C2BC",
    border: "1px solid #45524C", borderRadius: 20, padding: "6px 12px", fontSize: 11, cursor: "pointer",
    opacity: 0.85,
  },
};
