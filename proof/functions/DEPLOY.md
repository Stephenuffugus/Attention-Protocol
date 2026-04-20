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
