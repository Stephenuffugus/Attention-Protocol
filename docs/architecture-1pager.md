# SWS Attention Protocol — Architecture 1-Pager

**For:** procurement, security, and compliance reviewers doing tier-1 vendor qualification
**Pages:** 2 · **Read time:** ~3 min · **Authoritative source:** `docs/SECURITY_ARCHITECTURE.md`, `docs/technical-faq.md`, `docs/COMPLIANCE_MATRIX.md`
**Status as of 2026-04-29:** deployed to production, patent-filed, pre-revenue

---

## What it is, in one sentence

A cryptographic attention receipt — content-bound SHA-256, Ed25519-signed, optionally Bitcoin-anchored — that proves a real human was paying attention to a specific piece of content during a specific session, verifiable offline by any party with our public key. **No PII collected. No content stored. No webcam, no microphone, no IP logging.**

## Data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (zero PII leaves the device)                           │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ User         │→ │ 23-signal SDK    │→ │ Content-bound    │  │
│  │ interaction  │  │ (deterministic)  │  │ canonical JSON   │  │
│  └──────────────┘  └──────────────────┘  └────────┬─────────┘  │
│                                                    │            │
│  ┌────────────────────────────────────────────────▼─────────┐  │
│  │  SHA-256 (SubtleCrypto, FIPS 140-2 in Chrome/FF/Safari)  │  │
│  └────────────────────────────────────┬─────────────────────┘  │
└────────────────────────────────────────┼───────────────────────┘
                                         │ TLS 1.2+
┌────────────────────────────────────────▼───────────────────────┐
│  Firebase Cloud Functions (US, sws-attention-proofs)           │
│  ┌─────────────────────┐  ┌────────────────────────────────┐  │
│  │ signReceipt (HTTP)  │  │ onSessionWritten (the "wall")  │  │
│  │ Ed25519-signs JWT   │  │ Server-side composite recompute│  │
│  └─────────────────────┘  └────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ publicKey (HTTP)  →  /.well-known/attention-pubkey.json│   │
│  └────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Firestore: session receipts (no PII), 30-day TTL       │   │
│  │ Secret Manager: SWS_DID_SALT, SWS_SIGNING_KEY, _KID    │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                      Buyer / auditor verifies offline:
                      JWT + public JWKS = boolean valid/invalid.
                      Browser, Node, Python, Go all work.
                      Zero SWS server involvement at verify time.
```

## Seven attestation layers

| # | Layer | What it does | Source |
|---|---|---|---|
| 1 | **Environmental gate** | 7-vector multi-detector (BotD + WebGL + WebGPU + Function.toString + iframe-frontier + chrome.runtime + AudioContext prototype-shape). Catches puppeteer-extra-stealth class adversaries. Cross-browser graceful degradation. | `proof/sdk/environmental-gate.js` |
| 2 | **Behavioral composite** | 23 signals (21 weighted, 2 diagnostic) grounded in 50-70 years of motor-control + cognitive science. All deterministic formulas — no ML weights to drift. | `src/sdk/attention-protocol.js` |
| 3a | **Composition Integrity** | Paste-burst + keystroke-cadence detector. Statistics only — no characters stored. | `proof/sdk/composition-integrity.js` |
| 3b | **Honeypot canary** | Invisible prompt-injection token that trips LLM-assisted sessions. | `proof/sdk/honeypot-canary.js` |
| 4 | **Consent attestation** | GDPR Art. 7 / CCPA §1798.120 opt-in record encoded in every receipt. | `credentialSubject.consentAttestation` |
| 5 | **Ed25519 signature** | EdDSA JWT (RFC 8032) over the canonical receipt. Private key in Google Secret Manager, never transmitted off the server. JWKS rotation validated via dry-run. | `signReceipt` Cloud Function |
| 6 | **Content-bound SHA-256** | The receipt's hash IS the receipt. Any modification to any displayed value invalidates verification. Adversarial test: 100/100 random tamper variations detected. | `proof/verify.html` |
| 7 | **Optional anchoring** | RFC 3161 TSA token (DigiCert/Sectigo/GlobalSign) and/or OpenTimestamps Bitcoin anchor for long-term tamper-resistance. | `src/sdk/attention-tsa.js`, `attention-anchor.js` |

Plus: **server-side composite recompute** (the "wall," `onSessionWritten`) re-derives the composite server-side from the raw event log, preventing client-side score forgery. Bypass cost shifted from $50/mo + 56h to $5-20K/mo + 200-400h after wall deployment.

## How a buyer verifies

```js
// Node.js — same pattern works in browser via Web Crypto, Python, Go
const jwks = await fetch('https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json').then(r => r.json());
const { valid, payload } = await verifyJwt(jwt, jwks.keys[0]);
// valid: boolean. payload: full receipt fields. Zero SWS involvement.
```

Independently checkable in any browser at `https://sws-attention-proofs.web.app/verify.html` using only WebCrypto. **No account. No API key. No SWS server in the verification path.**

## Sub-processors

| Vendor | Purpose | Inheritance |
|---|---|---|
| Google Cloud / Firebase | Hosting, Cloud Functions, Firestore, Secret Manager, Anonymous Auth | SOC 2 Type II, ISO 27001, ISO 27017/18, FedRAMP High, HIPAA-eligible (BAA available) |
| FingerprintJS BotD | Bot-detection vector 1 of 7 (open-source library, runs client-side) | No data leaves the browser |
| OpenTimestamps (optional) | Bitcoin anchoring of receipt hash | Public calendar servers; receipt hash only, no PII |
| RFC 3161 TSA (optional) | Commercial timestamp authority | DigiCert / Sectigo / GlobalSign — buyer's choice |

**No other sub-processors.** No analytics SDKs in the protocol. No CDN tracking. The core SDK has zero npm dependencies — pure browser-native APIs.

## Compliance posture — what's true today

**Implemented:**
- Zero-PII architecture (no names, emails, IPs, fingerprints beyond BotD output, geolocation, content, keystroke characters).
- TLS 1.2+ in transit. AES-256 at rest (Firebase default). Content-bound SHA-256 over every displayed receipt field.
- GDPR Art. 7 / CCPA §1798.120 consent attestation in every receipt.
- 21 CFR Part 11 clause-by-clause mapping (`docs/COMPLIANCE_MATRIX.md` and `/part-11.html`); SWS addresses §11.10(a)(b)(c)(e), §11.50, §11.70, §11.200 partial. Operator controls (§11.10(d), §11.100-series) are buyer-side via SSO/MFA.
- COPPA-safe by construction (no PII collected, no identity required).
- SCIF-eligible by architecture (no content data stored, only behavioral metrics).
- 980+ automated tests across 46 suites. 7 hostile-review rounds plus 2026-05-07 production-tightening pass (R8); ~90 findings closed.
- Server-side wall (composite recompute) enforces score authenticity.
- Calibrated Bayesian P(human) with bootstrap 95% CI on every receipt (Vovk-Gammerman-Shafer 2005). Calibration set v2: 5 humans + 28 bots, growing.

**Not implemented yet:**
- SOC 2 Type II audit (rely on Firebase's underlying SOC 2 for infrastructure attestation).
- ISO 27001 certification.
- HIPAA BAA (Firebase BAA available; SWS-specific BAA after entity formalization).
- Paid third-party penetration test (7 hostile-review rounds were internal/AI-agent driven, not contracted pen-test).
- Formal DPIA on file (sketched in `docs/COMPLIANCE_MATRIX.md`; full DPIA after first signed pilot).
- Dedicated security officer / 24/7 SOC.
- Cyber-liability insurance (after entity formalization).

The product is built to operate at the procurement bar of a tier-2 pilot ($5-30K). Tier-1 enterprise contracts (Pfizer-scale) require the not-yet items above before signing.

## Key facts worth citing

- **Provisional patent:** USPTO, filed 2026-03-17, 247 innovations across 24 categories. Utility conversion deadline 2027-03-17.
- **Live deploy:** `sws-attention-proofs` Firebase project. 3 Cloud Functions, 3 secrets in Google Secret Manager, Firestore TTL on session rows.
- **Tamper resistance:** 100/100 random DOM-level modifications detected. 27/27 pathological canonical inputs (Unicode, RTL, CJK, deeply-nested, NaN/Infinity) produce deterministic hashes.
- **Bot resistance:** 5/5 documented adversarial attack vectors caught with 5-7× margin in 1000-session synthetic validation. 0 false positives on 1000 synthetic human sessions. Gated composite gap 0.243-0.262 across all tested bot profiles.
- **Latency:** Server-side recompute 0.19-1.59ms across 100-5000 event logs. Cloud Function 60s timeout = 38,000× headroom.
- **Verification surface:** any browser, any language with Ed25519 + SHA-256. JWKS rotation validated via dry-run.

## Single point of contact

Stephen Furpahs · solo founder · `stephenfurpahs@gmail.com`
SWS Strategic Media LLC · patent SWS-PROV-001 · Uniontown, OH
Reviewer entry point: https://sws-attention-proofs.web.app/for-reviewers.html
