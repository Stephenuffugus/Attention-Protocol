# Runbook: Firestore Outage / Quota Exceeded / Failover

**When to run:** Firestore writes failing in the cme-demo flow; `signReceipt` HTTP returns 5xx; `onSessionWritten` trigger errors visible in Cloud Functions logs.

**RTO target:** restore demo flow within 1 hour. (Verifier path is independent of Firestore — verify.html keeps working.)

## Symptoms

- cme-demo.html: "Save failed: permission-denied" or "deadline-exceeded"
- Cloud Functions logs: `Firebase Storage error` / `Firestore error`
- Session_fingerprints query throws `FAILED_PRECONDITION` → trace-novelty silently degrades to `traceNovelty.checked: false`
- Customer-reported: "I clicked Submit but no receipt appeared"

## Triage

1. **Check Firebase Status:** https://status.firebase.google.com
2. **Check our quota:** https://console.cloud.google.com → Firestore → Usage
3. **Check rules deploy version:** `firebase firestore:rules:list`
4. **Check trace-novelty composite index:**
   ```bash
   gcloud firestore indexes composite list \
     --collection-group=session_fingerprints
   ```
   The index `(fingerprint ASC, signed_at ASC)` MUST exist or
   trace-novelty queries throw FAILED_PRECONDITION on every call.

## Restore

### Quota exceeded
- Check if a write-flood attack is in progress: query `demos/*` count
  in the last hour vs baseline.
- If attack: tighten Firestore rules to require explicit auth claim;
  enable App Check (still queued as R2-NEW-21).
- If legitimate growth: upgrade to Blaze tier with higher quota.

### Index missing (trace-novelty broken)
- Apply: `firebase deploy --only firestore:indexes`
- This deploys `proof/firestore.indexes.json` (round-7 fix) which
  defines the required composite index.
- Index creation takes 5-30 minutes.
- Validate: re-run a known-fingerprint session and confirm
  `trace_novelty.checked: true` in the resulting receipt.

### Rules deploy regression
- Check git log on `proof/firestore.rules` for recent changes.
- If a rule landed that breaks the demo, revert + redeploy:
  ```bash
  firebase deploy --only firestore:rules
  ```

### Outage in progress (no fix on our end)
- Communicate status to customers.
- Verifier path stays up; receipts issued before outage are still
  fully verifiable. Tell pilots their existing receipts are unaffected.

## Validate

- [ ] cme-demo.html submit produces a receipt
- [ ] The receipt has `trust_tier: 'server_attested'` (or one of the
      acceptable mid-tiers, depending on what the user did)
- [ ] Cloud Functions logs show no Firestore errors for 10 minutes
