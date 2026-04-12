# DEPLOY ATTENTION PROTOCOL DATA COLLECTION — 10 MINUTE CHECKLIST
## For: Stephen Furpahs, Director
## Goal: Verify sws-attention-proofs is collecting real sessions, then start the beta

---

## GOOD NEWS

The demo page at **https://sws-attention-proofs.web.app/demo.html** already has:
- Firebase config pointing at `sws-attention-proofs` project
- Anonymous auth sign-in code
- Session saving to `demos/` collection in Firestore
- Source tagging via URL parameter (`?source=beta_ff`)

**You may not need to change anything.** This checklist verifies everything is wired up. If it already works, you skip straight to sending beta links.

---

## BEFORE YOU START

You will need:
- [ ] Laptop or desktop
- [ ] Login to **console.firebase.google.com** (the account that owns `sws-attention-proofs`)
- [ ] Your phone, for the verification test
- [ ] 10 minutes

---

## STEP 1 — Verify Anonymous Auth is Enabled (2 minutes)

1. Open: **https://console.firebase.google.com**
2. Click the **sws-attention-proofs** project tile
3. Left sidebar → click **Build** → click **Authentication**
4. If you see a "Get Started" button, click it
5. Click the **Sign-in method** tab
6. Find **Anonymous** in the list of providers
7. **If it says "Enabled"** → skip to Step 2, you're good
8. **If it says "Disabled"** → click the row → toggle **Enable** to ON → click **Save**

**Verify:** The Anonymous row says "Enabled" in green.

---

## STEP 2 — Verify Firestore Rules (3 minutes)

1. In the same Firebase Console, left sidebar → click **Firestore Database**
2. Click the **Rules** tab
3. Check that the rules allow authenticated writes to the `demos/` collection. If you see the rules below (or similar), you're good. If the rules are blank or default, paste these:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /runs/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /latest/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /demos/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **Publish** if you changed anything.

---

## STEP 3 — Live Verification (5 minutes)

### 3a. Desktop test

1. Open Chrome
2. Go to: **https://sws-attention-proofs.web.app/demo.html?source=dev**
3. Press **F12** to open DevTools → **Console** tab
4. Interact with the demo page for 30-60 seconds — scroll, click, read
5. Look for console messages:
   - `[Demo] Auth failed: ...` = **Step 1 wasn't saved.** Go back to Firebase Console.
   - `Save failed: permission-denied` = **Step 2 rules are wrong.** Go update rules.
   - `Session saved to proof catalog.` = **IT WORKS.**

### 3b. Firestore verification

1. Firebase Console → **Firestore Database** → **Data** tab
2. Click the **`demos`** collection
3. You should see a new document with an ID like `demo_1712956800000_abc123`
4. Click it → verify it has fields: `session_id`, `signals`, `quality_tier`, `source_type: "dev"`, `uid`

### 3c. Phone test (the real one)

1. On your phone, open: **https://sws-attention-proofs.web.app/demo.html?source=beta_ff**
2. Interact with the demo for 2 minutes
3. Check Firestore → `demos` → new document should appear with `source_type: "beta_ff"`

---

## WHAT SUCCESS LOOKS LIKE

After verification passes, every visit to the demo page generates a Firestore record containing:
- All 6 behavioral signals (timing entropy, Fitts, Hick, scroll saccade, micro-pause, touch)
- Composite human-confidence score
- Quality tier (deep/active/passive/background)
- Hash count
- GA4 comparison data (what GA4 WOULD capture vs what SWS captures)
- Source tag so you know where the session came from

**This is production data collection. No further deploys needed. Start texting people the link.**

---

## THE BETA LINKS

Use these exact URLs when texting. The `?source=` tag tells us who sent them:

| Purpose | URL |
|---|---|
| **Your own testing** | `https://sws-attention-proofs.web.app/demo.html?source=dev` |
| **Friends & family beta** | `https://sws-attention-proofs.web.app/demo.html?source=beta_ff` |
| **Market research prospects** | `https://sws-attention-proofs.web.app/demo.html?source=pilot_mktres` |
| **Restaurant industry contacts** | `https://sws-attention-proofs.web.app/demo.html?source=pilot_restaurant` |
| **Nursing home contacts** | `https://sws-attention-proofs.web.app/demo.html?source=pilot_nursing` |
| **Corporate training contacts** | `https://sws-attention-proofs.web.app/demo.html?source=pilot_training` |
| **Adversarial red-team testing** | `https://sws-attention-proofs.web.app/demo.html?source=adversarial_test` |

Every session is automatically tagged. When a buyer asks "show me the data," you query `source_type = pilot_mktres` and they see only their industry.

---

## STEVIEWEEDSEED.COM (SEPARATE, LOWER PRIORITY)

The stevieweedseed.com Hostinger deploy (getting organic visitor hashes from the seed site into `focus-grove-fffa8`) is a separate task. It still matters, but your fastest path to data that impresses YC and buyers is the demo page above — it collects richer signals and tags cleanly.

The original `WEBSITE_TEAM_HANDOFF_Firestore_Sync_Fix.md` still applies to stevieweedseed.com whenever you're ready for that deploy.

---

## IF SOMETHING BREAKS

**Nothing can break your live sites.** The demo page is hosted on Firebase's own infrastructure at sws-attention-proofs.web.app. Stevieweedseed.com is not touched. Lucid Wins is not touched.

**Cost control:** Anonymous auth + Firestore writes are free for the first 50K ops/day on Firebase free tier. Friends-and-family beta won't approach 1% of that.

**If you hit a wall:** Come back to the Codespace and paste the Chrome console error message. I'll tell you which step to revisit.

---

*Prepared by the SWS Attention Protocol Engineering Team*
*Date: 2026-04-12*
*Updated: targeting sws-attention-proofs (not focus-grove-fffa8)*
