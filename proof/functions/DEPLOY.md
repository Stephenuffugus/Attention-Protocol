# SWS Functions — Deploy Guide

## What's here

Three cloud functions that turn the SWS demo from "verify-pre-signed-JWTs"
into "real users mint their own credentials":

1. **`signReceipt`** (HTTPS POST) — browser calls with session data,
   gets back a signed, time-bounded JWT + credential URL.
2. **`publicKey`** (HTTPS GET) — convenience redirect to the JWKS.
3. **`onSessionWritten`** (Firestore trigger on `demos/{sessionId}`) —
   auto-signs any session created by `demo.html`, writes the signed
   JWT and credential URL back to the doc so the client reads it with
   zero extra roundtrips.

## Prerequisites

- Firebase project: `sws-attention-proofs` (already linked via
  `../.firebaserc`)
- **Blaze plan** (pay-as-you-go). Cloud Functions are not available
  on Spark. Free quota is 2M invocations/month — well above pilot scale.
- Node 20 runtime (set in `package.json` engines).

## One-time setup

```bash
cd proof/functions
npm install
```

Then load the signing key as a Firebase secret (NOT an env var):

```bash
firebase functions:secrets:set SWS_SIGNING_KEY
# Paste the SAME hex private key that's in ../../.env
# (generated originally by scripts/generate-keypair.js)

firebase functions:secrets:set SWS_SIGNING_KID
# Paste the kid — defaults to "sws-attention-2026-04"
```

Secrets live in Google Secret Manager; they are NEVER written to logs
and are injected at runtime only into functions that explicitly declare
they need them. Rotation: repeat `functions:secrets:set`, redeploy.

## Deploy

```bash
firebase deploy --only functions
```

On success you'll see three URLs:

```
signReceipt(us-central1):   https://signreceipt-...run.app
publicKey(us-central1):     https://publickey-...run.app
onSessionWritten(us-central1): (Firestore trigger, no URL)
```

## Wire demo.html to use `signReceipt`

After a demo session completes, `demo.html` should POST the session
payload to the function URL and receive a signed JWT. Suggested
integration (already stubbed in `prove-humanness.html`):

```javascript
const res = await fetch('https://signreceipt-XXX.run.app', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionData.session_id,
    composite: sessionData.signals.composite,
    signals: sessionData.signals,
    duration_ms: sessionData.duration_sec * 1000,
    focus_score: Math.round(sessionData.signals.composite * 100),
    quality_tier: sessionData.quality_tier,
    environmental: sessionData.environmental,
    composition_integrity: sessionData.composition_integrity,
    consent: sessionData.consent
  })
});
const { signed_jwt, credential_url } = await res.json();
```

Or — simpler — just let the Firestore trigger do it automatically:
`demo.html` already writes `demos/{sessionId}` on completion, the
trigger signs it asynchronously (~500ms typical), and the client can
read back `signed_jwt` from the same doc via a real-time listener.

## Cost ceiling

At pilot scale (1k sessions/day = 30k/month), you'll be inside Blaze's
free tier: 2M invocations, 400k GB-seconds, 200k CPU-seconds per month
are all free. Expect $0 until you're serving ~60k+ sessions/day.

## Security properties

- Private key stored in Google Secret Manager, NEVER in environment
  variables, repository, or function source.
- Error messages sanitize any 32+ char hex string to `<REDACTED>` before
  logging (defense against accidental key leakage).
- CORS enabled by default; restrict via allowed origins before production.
- No rate limiting yet — add Cloud Armor or a per-IP middleware before
  scaling beyond demo.

## Local emulation

```bash
firebase emulators:start --only functions,firestore
```

Then POST to `http://127.0.0.1:5001/sws-attention-proofs/us-central1/signReceipt`.

## Rollback

```bash
firebase functions:delete signReceipt
# etc. — each function can be removed independently without breaking others
```

## THE WALL — Firestore prerequisites (R2-NEW-2b trace-novelty)

The wall (R2-NEW-2 + R2-NEW-2b) writes a fingerprint per signed session
to a `session_fingerprints` collection and queries it for replay
detection. Two configuration steps required for production:

### 1. Composite index

The trace-novelty query is:
```
where('fingerprint', '==', fp).where('signed_at', '>=', oneHourAgo)
```

Firestore needs a composite index on `(fingerprint ASC, signed_at ASC)`.
On first invocation Firestore returns `FAILED_PRECONDITION: query
requires an index` with a console URL — click it, or create explicitly:

```bash
gcloud firestore indexes composite create \
  --collection-group=session_fingerprints \
  --field-config field-path=fingerprint,order=ascending \
  --field-config field-path=signed_at,order=ascending
```

Without this index the trigger's trace-novelty query throws and the
wall silently degrades to `traceNovelty.checked: false` — receipts get
tagged `trace_novelty_firestore_error` and downgraded to
`client_attested_bounds_violated` (round-6 R6-NEW-8 fix). The wall
still rejects, but you lose the replay-detection signal.

### 2. TTL policy on `signed_at`

Fingerprints accumulate forever without a TTL. Replay window is 1 hour;
24-hour retention is sufficient and bounds storage cost. Configure via:

```bash
gcloud firestore fields ttls update signed_at \
  --collection-group=session_fingerprints \
  --enable-ttl
```

Without TTL, ~365k docs/year at 1k sessions/day balloons under attack.
Storage cost: $0.18/GB/mo + $0.06/100k writes. An attacker who fuzzes
1M session POSTs (~$60 attack cost) burns ~$200/mo recurring storage.

### 3. Firestore rules

Round-6 R6-NEW-3 added an explicit rule for the collection
(`firestore.rules`):

```
match /session_fingerprints/{document=**} {
  allow read, write: if isAdmin();
}
```

Admin SDK (the trigger context) bypasses rules at runtime, but having
the explicit rule defends against accidental client-side access if a
future page tries to read fingerprints (which are quantized statistical
summaries — not PII, but not user-readable either).
