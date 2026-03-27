# SWS Attention Protocol — Deployment Guide
## Everything you need to go from this repo to a live demo

---

## STEP 1: Fix the Live Site (stevieweedseed.com) — 10 minutes

### 1A: Enable Anonymous Auth
1. Go to https://console.firebase.google.com
2. Open **focus-grove-fffa8** project
3. Click **Authentication** → **Sign-in method** tab
4. Find **Anonymous** → toggle **Enable** → click **Save**

### 1B: Upload the Sync Fix
1. Log into Hostinger file manager
2. Find where your JavaScript files are (look for where `firebase.initializeApp` lives)
3. Upload `src/sdk/firestore-sync-fix.js` to the same directory
4. Add this line to your HTML, AFTER the Firebase scripts:
```html
<script src="firestore-sync-fix.js"></script>
```

### 1C: Update Firestore Rules
1. Go to Firebase Console → Firestore → Rules
2. Replace rules with contents of `src/sdk/firestore.rules`
3. Click **Publish**

### 1D: Verify
1. Open stevieweedseed.com in Chrome
2. Open DevTools Console (F12)
3. Look for: `[Attention Sync] Authenticated as: [uid]`
4. Wait 5 minutes, look for: `[Attention Sync] Syncing X hashes to Firestore...`
5. Check Firebase Console → Firestore → `vaults` collection should now have data

---

## STEP 2: Deploy the Dashboard — 5 minutes

### Option A: Hostinger (simplest)
1. Upload the entire `src/dashboard/` folder to Hostinger
2. Access at your domain + /dashboard/

### Option B: Firebase Hosting (recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting  # Select focus-grove-fffa8, set public dir to src/dashboard
firebase deploy
```
Dashboard will be at: https://focus-grove-fffa8.web.app

### Update Firebase Config
Edit `src/dashboard/js/dashboard.js` line 14-20 with your real Firebase config:
```javascript
var firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY",
  authDomain: "focus-grove-fffa8.firebaseapp.com",
  projectId: "focus-grove-fffa8",
  storageBucket: "focus-grove-fffa8.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Get these from: Firebase Console → Project Settings → Your apps → Web app

---

## STEP 3: Deploy the Sales Site — 10 minutes

Upload the `public/site/` folder to your hosting. This is the page you send prospects to.

Upload the `public/verticals/` folder for the vertical-specific demo pages.

Upload the `public/demo/` folder for the live SDK demo.

---

## STEP 4: Set Up Firestore Indexes (for Dashboard queries)

In Firebase Console → Firestore → Indexes, create:

**Composite Index 1:**
- Collection group: `hashes`
- Fields: `timestamp` (Ascending)
- Query scope: Collection group

This enables the dashboard's `collectionGroup('hashes')` query.

---

## STEP 5: What to Send Prospects

### Before the meeting:
- Link to sales site: yourdomain.com/site/
- Link to their vertical demo: yourdomain.com/verticals/[vertical].html

### During the meeting:
- Open the live demo: yourdomain.com/demo/
- Open the dashboard: yourdomain.com/dashboard/
- Show the vertical-specific page
- Show the ROI calculator
- Show the one-line integration code

### After the meeting:
- Send the compliance matrix: docs/COMPLIANCE_MATRIX.md
- Send the API spec: docs/API_SPECIFICATION.md
- Send the security architecture: docs/SECURITY_ARCHITECTURE.md
- Offer the 30-day free pilot

---

## FILE MAP

```
src/
  sdk/
    attention-protocol.js    — Core SDK (drop on any page)
    economy-engine.js        — Daily caps, multipliers, vault
    privacy-compliance.js    — GDPR/CCPA/COPPA, consent, export, delete
    attention-receipts.js    — Cryptographic receipts for B2B audits
    share-to-earn.js         — Share tracking, referrals, viral loop
    movement-fitness.js      — GPS steps, accelerometer, fitness bridges
    secure-config.js         — Runtime config for trade secrets
    integration-examples.js  — Copy-paste examples for every vertical
    firestore-sync-fix.js    — Drop-in fix for live site
    firestore.rules          — Firestore security rules
  dashboard/
    index.html               — Attention Quality Dashboard
    css/dashboard.css        — Dashboard styles
    js/dashboard.js          — Dashboard logic
  extension/
    manifest.json            — Chrome extension manifest
    background.js            — Extension background worker
    popup.html/js            — Extension popup UI
  api/
    b2b-client-sdk.js        — Lightweight B2B client tag

public/
  demo/index.html            — Live SDK demo (self-proving)
  verticals/                 — Vertical-specific demo pages
    advertising.html
    market-research.html
    insurance.html
    healthcare.html
    military.html
  site/                      — Enterprise sales site
    index.html
    css/site.css
    js/site.js

docs/
  COMPLIANCE_MATRIX.md       — HIPAA, SCIF, SOC2, GDPR, CCPA, COPPA, FERPA
  API_SPECIFICATION.md       — Full REST API spec
  SECURITY_ARCHITECTURE.md   — Security architecture for enterprise review

tests/
  test-core.html             — Automated test suite (open in browser)
```
