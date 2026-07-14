# Budget Ledger

Your personal budget planner: wallets, fixed payments, daily expenses, and charts —
now backed by Firebase, so data syncs across every device you sign into.

## 1. Set up Firebase (one-time, ~5 min)

1. Go to https://console.firebase.google.com → **Add project** → give it a name → finish.
2. **Build → Firestore Database** → **Create database** → **Production mode** → pick a region.
3. **Build → Authentication** → **Get started** → enable **Email/Password**.
4. **Project settings (gear icon) → Your apps → </> (Web)** → register an app → copy the
   `firebaseConfig` object shown.
5. Paste that config into `src/firebase.js`, replacing the placeholder values.
6. In Firestore → **Rules** tab, paste this and **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /budgetLedgers/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   This means only your signed-in account can read or write your data.

**Note on the API key:** Firebase's web config (including `apiKey`) is meant to be
public — it's fine that it ends up visible in your GitHub repo and browser bundle.
Firebase security comes from the Firestore rules above, not from hiding the key.

## 2. Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Create an account (any email/password — it doesn't
send a real email, it's just your login), then use the app. Sign into the same
account on your phone later and you'll see the same data.

## 3. Deploy with GitHub + Vercel

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then on https://vercel.com: **Add New → Project** → import that repo → deploy
(Vercel auto-detects Vite, no config needed).

## 4. Add it to your phone's home screen (as a real app icon)

This project is set up as a PWA (Progressive Web App), so it opens full-screen
with no Safari address bar once added to your home screen.

1. Open the deployed URL in **Safari** on your iPhone.
2. Tap the **Share icon** → **Add to Home Screen** → **Add**.
3. If you'd already added it before this update, **delete the old icon first**,
   then re-add it so it picks up the new full-screen behavior.
4. Launch it from the new home screen icon (not from Safari) — that's what
   triggers the app-like full-screen mode.

## About the two locks

- **App passcode** (inside the app, Lock tab): a quick PIN to keep the screen from
  being casually opened. Not real encryption.
- **Firebase sign-in** (email/password): this is what actually protects and syncs
  your data across devices.
