# Runbook: Billing Overrun / Cost Spike

**When to run:** GCP Budget alert fires (R2-NEW-22 — when wired); Firebase usage dashboard shows abnormal spike; daily Stripe email shows unexpected GCP charges.

**RTO target:** stop the bleed within 1 hour; figure out the cause within 24 hours.

## Symptoms

- GCP Budget alert email
- Firebase Usage Dashboard: huge spike in Cloud Functions invocations or Firestore reads/writes
- Cost > $X/day (define X for your budget — round-1 SRE recommended $50/mo cap)

## Triage — likely causes

1. **Bot fuzzing the demo** (most common). Unbounded anonymous-auth
   write to `demos/*` → trigger fires per write → Cloud Function
   invocation × thousands.
2. **Trace-novelty fingerprint collection growth without TTL** —
   round-7 added the TTL config in `firestore.indexes.json`; if
   deploy didn't apply, collection grows unbounded.
3. **Legitimate traffic spike** (e.g., a viral tweet about the demo).
4. **Misconfigured client retry loop** — a bug in cme-demo.html
   submitting in an infinite loop.

## Stop the bleed (immediate)

1. **Disable the Cloud Function** to stop signing:
   ```bash
   firebase functions:delete onSessionWritten
   firebase functions:delete signReceipt
   ```
   Verifier path stays up.

2. **Tighten Firestore rules** to deny all writes to `demos/`:
   ```
   match /demos/{document=**} {
     allow read, write: if false; // emergency lockdown
   }
   ```
   Deploy: `firebase deploy --only firestore:rules`.

3. **If TTL config didn't apply on session_fingerprints**, manually
   bulk-delete:
   ```bash
   gcloud firestore export gs://sws-firestore-backups/pre-cleanup-$(date +%F)
   # then bulk-delete via console or gcloud import-export
   ```

## Diagnose

1. Identify the source IP / uid spamming via Cloud Logging:
   ```
   resource.type="cloud_function" AND
   resource.labels.function_name="onSessionWritten" AND
   timestamp >= "2026-04-28T00:00:00Z"
   ```
2. Look for repeated patterns in the doc creation timestamps.
3. If a single uid: ban via custom Firestore rule.
4. If a single IP range: Cloud Armor IP blocklist.

## Restore

1. Re-deploy the Cloud Functions:
   ```bash
   firebase deploy --only functions
   ```
2. Restore Firestore rules to the round-6 baseline (uid-bound writes,
   admin reads).
3. Add the offending uid/IP to a deny list (custom rule or Cloud Armor).
4. Confirm App Check is enabled (R2-NEW-21 — still queued; this
   incident is a forcing function to ship it).

## Post-mortem

- Cost incurred ($)
- Time to detect (alert → triage start)
- Time to mitigate (triage start → bleed stopped)
- Root cause
- Preventive fix (e.g., App Check + tighter rate limits)
