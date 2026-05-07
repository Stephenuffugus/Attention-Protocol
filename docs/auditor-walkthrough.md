# Auditor Walkthrough — Verifying a SWS Attention Receipt

**For:** ACCME surveyors, pharma compliance officers, internal audit teams, customer security reviewers
**Companion to:** `docs/threshold-derivation-methodology.md`
**Author:** Stephen Furpahs, SWS Strategic Media LLC
**Version:** 1.0 — 2026-05-07

You have been handed a SWS Attention Protocol receipt — a JWT — by a CME provider, market-research platform, or other deploying organization. They claim it attests that a real human paid attention to a specific activity. This document is the step-by-step walkthrough for independently verifying that claim.

You do not need to trust SWS Strategic Media. You need to verify the math.

---

## What you have, what you need, what you'll produce

**What you have**
- A JWT (JSON Web Token) — three base64url-encoded segments separated by dots, looks like `eyJhbGciOiJFZERTQSIs...`
- The deployer's claim about the activity, learner, and timestamp

**What you need** (all public, no SWS infrastructure required at verification time)
- The SWS public verification key (JWKS) — published at `https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json`
- A working installation of Node.js (version 18 or newer) — same Node available on every standard developer workstation
- The verifier script — `scripts/verify-offline.js` from the public repository at `https://github.com/Stephenuffugus/Attention-Protocol`
- Optionally: 5 minutes of network connectivity to fetch the JWKS once. Then the verification is fully offline.

**What you'll produce**
- A pass/fail/expired determination on the receipt's cryptographic validity
- A decoded payload showing exactly what the receipt attests
- A trust-tier classification telling you which defense layers passed
- A list of any bounds violations the deployer's session triggered

---

## Step 1 — Cache the public key (one-time, ~10 seconds)

```bash
curl -s https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json > attention-pubkey.json
```

That's it. After this, you can verify any SWS receipt without further network calls. The key file rotates approximately annually; SWS publishes new keys with new key IDs (`kid`) so old receipts continue to verify against their original key indefinitely.

What you should see when you `cat attention-pubkey.json`:

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "YspKEQXSJeaWXrkwDgVT-TEChPJgT76Sw3lQbS3xNQ4",
      "kid": "sws-attention-2026-04",
      "use": "sig",
      "alg": "EdDSA",
      "sws_validFrom": "2026-04-01T00:00:00Z",
      "sws_validUntil": "2027-04-01T00:00:00Z"
    }
  ]
}
```

The `x` field is the public half of the Ed25519 keypair. The `sws_validFrom` and `sws_validUntil` define when this key was authoritative for issuing receipts — receipts dated outside that window must be rejected.

---

## Step 2 — Get the verifier script (one-time, ~10 seconds)

```bash
git clone https://github.com/Stephenuffugus/Attention-Protocol.git sws
cd sws
```

You now have the entire SWS source tree. The verifier is at `scripts/verify-offline.js`. Read it if you want — it uses only Node's built-in `fs`, `path`, and `crypto` modules. No network. No third-party dependencies. Approximately 100 lines of code.

You can read every line and confirm it does what it claims. SWS infrastructure is not invoked.

---

## Step 3 — Verify a receipt (every receipt, ~50 milliseconds)

```bash
node scripts/verify-offline.js \
  --jwt "eyJhbGciOiJFZERTQSIs..." \
  --jwks attention-pubkey.json
```

Output for a valid receipt:

```
[STEP 1/4] Decode JWT structure ......................... OK
  alg: EdDSA, typ: JWT, kid: sws-attention-2026-04

[STEP 2/4] Locate matching key in JWKS .................. OK
  matched kid sws-attention-2026-04, valid 2026-04-01..2027-04-01

[STEP 3/4] Verify Ed25519 signature ..................... OK
  signature matches public key — receipt is authentic

[STEP 4/4] Validate temporal claims ..................... OK
  iat: 2026-05-07T17:12:24Z (within validity window)
  exp: 2026-05-08T17:12:24Z (not yet expired)

VERDICT: VALID
Exit code: 0
```

The exit code is what you wire into automation: **0 = valid, 1 = invalid (signature failed or kid not found), 2 = expired or outside validity window.**

---

## Step 4 — Inspect the payload (every receipt, ~30 seconds of reading)

A valid signature tells you the receipt is authentic. The *payload* tells you what it actually attests.

```bash
node scripts/verify-offline.js --jwt "eyJ..." --jwks attention-pubkey.json --decode
```

You'll get a JSON object structured roughly like this:

```json
{
  "iss": "did:sws:attention-protocol",
  "sub": "did:sws:user:a1b2c3d4e5",
  "iat": 1778175144,
  "exp": 1778261544,
  "credentialSubject": {
    "engagement": {
      "contentId": "cme_hypertension_2026",
      "contentName": "Hypertension Management Update (2026)",
      "durationMs": 247000,
      "qualityTier": "active",
      "interactionCount": 5
    },
    "humanVerification": {
      "verdict": "verified_human_active_engagement",
      "compositeScore": 0.62,
      "trustTier": "server_attested",
      "serverRecompute": { "ok": true, "divergence": 0.012 },
      "boundsViolations": [],
      "traceNovelty": { "checked": true, "fingerprint": "fp2:7:48:42:55:4", "suspicious": false }
    },
    "consentAttestation": {
      "granted": true,
      "categories": ["attention_tracking"],
      "version": "2026-04"
    },
    "signals": {
      "composite": 0.62,
      "timing": 0.55,
      "fitts": 0.61,
      "...": "(20 more)"
    }
  }
}
```

### What each section means

**`engagement`** — what the user did, structurally. Activity ID, duration, quality tier, hash count. This is the section that maps to your audit's "did the learner complete the required engagement" question.

**`humanVerification`** — the cryptographic/behavioral attestation that this was a real human. The most important fields:
- `verdict`: human-readable summary
- `compositeScore`: a value in [0, 1] indicating behavioral-signal coherence with the human distribution. **This is population-relative — see threshold-derivation-methodology.md for how a deploying organization sets the threshold.** A 0.62 is not "passing" or "failing" without a deployer-defined threshold against their population.
- `trustTier`: which defense layers attested this session. Possible values:
  - `server_attested` — strongest. Server-side composite recompute matched the client claim, and the trace-novelty fingerprint did not match any other recent session from a different uid.
  - `client_attested_bounds_clean` — server recompute either could not run or fell outside threshold, but no bounds violations. Lower confidence.
  - `client_attested_no_event_log` — receipt issued without raw event-log data; server could not independently recompute. Audit posture is purely behavioral.
  - `client_attested_bounds_violated` — at least one bounds violation was detected. The receipt is still issued (so the session is on record) but the trustTier flags it for manual review.
- `serverRecompute`: when present, contains `divergence` — the absolute difference between client-claimed composite and server-recomputed composite. Less than 0.05 is normal.
- `boundsViolations`: an array of strings naming any defense layer that flagged the session. Expected to be empty for legitimate users. Common entries: `trace_novelty_low:N_other_uid_in_last_hour` (a recorded-replay attack detected), `runwall_error` (server recompute could not run).
- `traceNovelty`: when `checked: true`, the fingerprint is a coarse-bucket hash of session statistics. If `suspicious: true`, the same fingerprint was seen on a different uid in the recent window — likely a replay attack.

**`consentAttestation`** — whether the user granted consent, which categories, and which version of the consent agreement. Required for GDPR / CCPA compliance.

**`signals`** — the 23 behavioral signals' final scores. Each is in [0, 1]. The composite is computed from these. You don't need to inspect these for a basic audit; they are present for forensic analysis if the trust tier is downgraded.

---

## Step 5 — Cross-check temporal claims (every receipt, ~10 seconds)

The `iat` (issued at) and `exp` (expires) timestamps in the JWT should be consistent with the deployer's claim about when the activity was completed.

```bash
# Convert iat to readable timestamp
date -d @1778175144  # GNU date
date -r 1778175144   # macOS date
```

If the deployer claims the session happened "yesterday afternoon" and the `iat` says it was issued three months ago, something is wrong. The receipt cannot have been forged forward in time (signing requires the private key, and old keys lose authority on `sws_validUntil`), but it can be replayed — see `traceNovelty` for that defense.

---

## Step 6 — Bitcoin-anchored timestamp (optional, for high-value cases)

If the deployer cites a Bitcoin OpenTimestamps anchor, the receipt's hash was committed to the Bitcoin blockchain at a specific block height. This lets you prove the receipt existed *at or before* a specific point in time, independent of any clock controlled by SWS or the deployer.

To verify:

```bash
ots verify <receipt-hash>.ots
```

Returns a Bitcoin block hash and timestamp. If the deployer claims the activity happened at time T, and the OTS anchor proves the receipt existed at time T+δ for small δ, the receipt cannot have been backdated. Useful for high-stakes audits (FDA inspections, multi-year retrospective reviews).

OpenTimestamps is free, open-source, and operated by a non-profit (`opentimestamps.org`). SWS does not control it.

---

## What this verification gives you, layer by layer

| Layer | What it proves | Failure mode |
|---|---|---|
| Ed25519 signature | The receipt was signed by SWS's private key during the validity window | Tampered receipt or wrong-issuer claim |
| JWKS kid match | The signing key was authoritative at issue time | Receipt issued with a key not authorized for the time window |
| Temporal validity (iat/exp) | The receipt has not expired | Expired credential being replayed |
| `trustTier == server_attested` | Server independently recomputed the composite from raw events and agreed with the client claim | Client-side score forgery |
| Empty `boundsViolations` | No defense layer flagged the session | Replay attack, bot detected, or other anomaly |
| `traceNovelty.suspicious == false` | This session's fingerprint is novel (not a replay) | Recorded-trace replay attack |
| Bitcoin-anchored OTS | The receipt existed at or before the anchored block | Backdating attempt |

A receipt that passes all seven layers is a high-confidence attestation. A receipt that fails any one is auditable evidence of *what* failed and *why* — that's also useful information for compliance.

---

## What this verification does NOT prove

Be honest with yourself and with anyone you report to:

- **It does not prove the user's identity.** SWS attests *engagement quality*, not identity. If your audit requires "this specific person did this activity," you need a separate identity layer (board ID, biometric, known-device) that the deployer binds to the SWS receipt.
- **It does not prove subjective comprehension.** The receipt confirms behavioral signals consistent with a real human paying attention. It does not confirm the learner understood the material. Comprehension testing is the deployer's responsibility, layered above the engagement attestation.
- **It does not detect adversaries that have not been measured.** The bypass-cost analysis in `docs/adversary-analysis-2026-05-07.md` is honest about which adversary classes have been measured (six bot profiles) and which have not (LLM-in-the-loop is preliminary; browser-extension injection is unmeasured). New adversaries develop over time. The protocol's response is continuous hostile review and methodology publication.

---

## Common audit scenarios

### Scenario A — ACCME accreditation surveyor

You are auditing a CME provider's claim that physicians earned credit on a specific accredited activity in 2026.

**Steps:** 1, 2, 3, 5. Spot-check `humanVerification.trustTier == server_attested` on a sample of 10–20 receipts. Confirm the `engagement.contentId` matches the activity in question. Note any `boundsViolations` for the provider's QA team to review. Total time per receipt: ~60 seconds. Cost to your organization: zero (no SWS contract, no API key, no support call).

### Scenario B — Pharma IME compliance review

You are reviewing whether the IME activity your company funded produced legitimate engagement before approving the renewal grant.

**Steps:** 1, 2, 3, 4, 5. Pull a stratified sample of 50–100 receipts across the activity. Aggregate the `humanVerification.trustTier` distribution. If >90% are `server_attested` and the deployer's threshold-derivation methodology document is on file, the engagement evidence is defensible.

### Scenario C — FDA Part 11 inspection

You are inspecting a pharma's electronic records for compliance with 21 CFR Part 11 §11.10(a) on signature integrity.

**Steps:** 1, 2, 3, 4, 5, 6. The Bitcoin-anchored timestamp (Step 6) is the strongest available evidence that the record existed at the claimed time. Combined with the Ed25519 signature, the chain is: hash → signed by issuer → anchored to public chain. Each link is independently verifiable.

### Scenario D — Customer security review (procurement)

You are evaluating whether to integrate SWS into your platform.

**Steps:** 1, 2, 3 on a sample SWS-provided receipt. Read `scripts/verify-offline.js` source to confirm zero phone-home behavior. Read `docs/threshold-derivation-methodology.md` for the calibration protocol you would run on your own population. Evaluate the trust posture: zero PII collected, no vendor in the verification loop, methodology open for independent review.

---

## What to do when verification fails

If the signature does not verify (exit code 1):

- The receipt has been tampered with, OR
- You are using the wrong JWKS file (e.g., from a fork or a stale copy), OR
- The kid in the receipt header does not match any key in your JWKS — meaning the receipt was issued by a key not currently published

In all three cases, **do not trust the receipt.** Contact the deployer to confirm the receipt was sourced from production SWS infrastructure. Request a fresh receipt. If the failure persists, escalate to SWS at `stephenfurpahs@gmail.com` for investigation.

If the receipt is expired (exit code 2):

- The receipt was issued more than 24 hours before your verification (default JWT validity window)
- Request a fresh receipt from the deployer if real-time verification is required, OR
- Use the Bitcoin-anchored timestamp (Step 6) to prove the receipt existed at the time the activity was claimed to have happened

---

## Auditor's checklist (copy-paste)

```
□ JWKS file fetched and saved locally
□ Verifier source reviewed (~100 lines)
□ Sample receipts verified — exit code 0
□ trustTier distribution: ____ server_attested / ____ other
□ boundsViolations: any non-empty arrays inspected
□ traceNovelty.suspicious: any true values inspected
□ iat / exp timestamps consistent with deployer's claim
□ Optional: OTS anchor verified for high-stakes receipts
□ Methodology doc reviewed
□ Threshold-derivation evidence reviewed (deployer-side)
□ Audit memo drafted
```

---

## Bottom line for your report

What you can write in your audit memo with full confidence:

> *"The SWS Attention Protocol receipts in scope were independently verified using the public Ed25519 verification key (`kid: sws-attention-2026-04`) and the published verifier source (`scripts/verify-offline.js`). [N] of [N] receipts validated. Trust-tier distribution: [X]% `server_attested`, [Y]% `client_attested_*`. No bounds violations detected on the audited sample. The verification was performed offline against a cached JWKS file with no SWS infrastructure invoked. The methodology underlying the threshold applied to the composite score is documented in `docs/threshold-derivation-methodology.md` and is calibrated to the deployer's own user population per the 4-step protocol described therein."*

That is a defensible, fully-traceable, mathematically grounded statement.

---

**Status:** Version 1.0, released 2026-05-07. Comments to stephenfurpahs@gmail.com. Updates will follow as additional verification scenarios surface in real audit engagements.
