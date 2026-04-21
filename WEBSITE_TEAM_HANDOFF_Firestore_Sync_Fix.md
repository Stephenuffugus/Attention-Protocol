

# URGENT HANDOFF — Website Team
## Fix: Attention Hashes Not Reaching Firestore
## Priority: IMMEDIATE
## From: Stephen Furpahs, Director
## Date: March 20, 2026 · Status refreshed 2026-04-21

---

## CURRENT STATUS (refreshed 2026-04-21)

**The SWS-side fix is already built and committed.** A drop-in module is in the repo at:

- `src/sdk/firestore-sync-fix.js` — the exact authentication + sync logic this handoff describes, wrapped as a single paste-ready IIFE
- `src/sdk/firestore.rules` — the Firestore security rules referenced in Step 4 below

Nothing further on the engineering side is required. The remaining blockers are all in the hosting / Firebase-console layer:

1. **Enable Anonymous Authentication in the Firebase Console** for project `focus-grove-fffa8` — Step 1 of "THE FIX" below. (2 min.)
2. **Apply the security rules from `src/sdk/firestore.rules`** to the Firestore console. (5 min.)
3. **Deploy `src/sdk/firestore-sync-fix.js`** to stevieweedseed.com via Hostinger — include it after the Firebase SDK and after the existing attention-hash code. (15 min.)

Until those three are done, visitor hashes will continue to land in `localStorage` with `synced: false` and the `vaults/` Firestore collection will stay empty. Once they're done, the first authenticated session on any page will back-sync every unsynced hash the visitor has accumulated.

**Why this still matters in April:** this is upstream of the "real user corpus N≥6" milestone needed for the YC submission. The receipts we'd show to any pilot buyer live in this collection.

---

## THE PROBLEM

The attention hash pipeline IS working. Hashes are being generated correctly with proper SHA-256 values, quality tiers, timestamps, and event types. They are stored in localStorage on each visitor's browser under the key `sws_attention_hashes`.

**However, the hashes are NOT syncing to Firestore.** Every hash record shows `"synced": false`. The `vaults/` collection in Firestore is empty. No data is reaching the cloud database.

**Root cause:** Visitors to the affiliate site are not authenticated through Firebase Auth. The Firestore sync function requires an authenticated user UID to write to `vaults/{uid}/hashes`. Without authentication, the sync function silently skips because there's no UID to write under.

---

## THE FIX

Add Firebase Anonymous Authentication so every visitor gets a temporary UID without needing to create an account or log in. This is a standard Firebase feature designed for exactly this use case.

### Step 1: Enable Anonymous Auth in Firebase Console

1. Go to https://console.firebase.google.com
2. Open the **focus-grove-fffa8** project
3. Click **Authentication** in the left sidebar
4. Click the **Sign-in method** tab
5. Find **Anonymous** in the list of providers
6. Click it, toggle **Enable** to ON, click **Save**

### Step 2: Add One Line to the Site's JavaScript

Find the site's initialization code — wherever Firebase is initialized (look for `firebase.initializeApp(firebaseConfig)` or similar). Add this line AFTER Firebase is initialized:

```javascript
firebase.auth().signInAnonymously().catch(function(error) {
  console.warn('[Attention] Anonymous auth failed:', error.code);
});
```

### Step 3: Make Sure the Auth State Triggers Sync

Find the existing hash sync code. There should already be an `onAuthStateChanged` listener or the sync function checks for `_getCurrentUid()`. If not, add this:

```javascript
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    console.log('[Attention] Authenticated as:', user.uid);
    // Sync any unsynced hashes from localStorage to Firestore
    _syncUnsyncedHashes(user.uid);
  }
});

function _syncUnsyncedHashes(uid) {
  var hashes = [];
  try {
    hashes = JSON.parse(localStorage.getItem('sws_attention_hashes') || '[]');
  } catch(e) { return; }

  var unsynced = hashes.filter(function(h) { return !h.synced; });
  if (unsynced.length === 0) return;

  console.log('[Attention] Syncing ' + unsynced.length + ' hashes to Firestore...');

  unsynced.forEach(function(record) {
    firebase.firestore().collection('vaults').doc(uid)
      .collection('hashes').add({
        hash: record.hash,
        event_type: record.event_type,
        timestamp: record.timestamp,
        game_id: record.game_id,
        quality_tier: record.quality_tier,
        duration_ms: record.duration_ms || 0,
        interaction_count: record.interaction_count || 0,
        page_id: record.page_id || '',
        synced: true
      })
      .then(function() {
        record.synced = true;
        localStorage.setItem('sws_attention_hashes', JSON.stringify(hashes));
      })
      .catch(function(err) {
        console.warn('[Attention] Sync failed for hash:', err);
      });
  });

  // Update balance document
  firebase.firestore().collection('vaults').doc(uid)
    .collection('balance').doc('current')
    .set({
      total_earned: hashes.length,
      total_spent: 0,
      current: hashes.length,
      last_updated: Date.now()
    }, { merge: true });
}
```

### Step 4: Update Firestore Security Rules

In the Firebase Console, go to **Firestore > Rules** and make sure the rules allow authenticated users (including anonymous) to write to their own vault:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /vaults/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Keep existing rules for other collections
    match /friendCodes/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## HOW TO VERIFY IT WORKED

After deploying the fix:

1. Open the live site in Chrome
2. Right-click > Inspect > Console
3. You should see: `[Attention] Authenticated as: [some_uid]`
4. Browse the site for 5+ minutes to generate some hashes
5. You should see: `[Attention] Syncing X hashes to Firestore...`
6. Go to Firebase Console > Firestore
7. You should now see a `vaults` collection with a document matching the UID
8. Inside that document, a `hashes` subcollection with real hash records

---

## WHAT'S ALREADY WORKING (DO NOT TOUCH)

The following is confirmed working correctly in production:

- Firebase project: `focus-grove-fffa8` — CORRECT
- Hash generation pipeline (buildAttentionPayload, generateAttentionHash, storeAttentionHash) — WORKING
- localStorage key `sws_attention_hashes` — POPULATED WITH REAL DATA
- Event types generating: `idle_drip` (passive), `tab_return` (active), `page_visit` (active) — ALL CORRECT
- Quality tier classification — CORRECT
- SHA-256 hashing — CORRECT
- Session IDs — UNIQUE PER SESSION
- game_id: `steveweetsie_web` — SET

**Do not modify the hash generation code. Only add the authentication and sync code described above.**

---

## EXPECTED RESULT

After this fix, every visitor to the site will:
1. Be silently authenticated with an anonymous Firebase UID (no login required, no UI change, invisible to the visitor)
2. Have their attention hashes automatically sync from localStorage to Firestore under `vaults/{anonymous_uid}/hashes`
3. Appear in the Firestore database with full hash records including quality tier, event type, timestamps, duration, and interaction count

This gives us the cloud-stored proof-of-concept data we need to demonstrate the protocol to potential B2B clients.

---

## TIMELINE

This should take 30 minutes or less to implement. It's 3 code changes:
1. Enable anonymous auth in Firebase console (2 minutes)
2. Add signInAnonymously() call + sync function to site JS (15 minutes)
3. Update Firestore security rules (5 minutes)
4. Test and verify (10 minutes)

**Deploy today. Every visitor from this point forward generates cloud-stored attention data.**

---

*Handoff prepared by the SWS Attention Protocol Engineering Team*
*For: Website Development Team*
*Director: Stephen Furpahs*
