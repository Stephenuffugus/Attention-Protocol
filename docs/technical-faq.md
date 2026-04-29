# SWS Attention Protocol — Technical FAQ
## For QA, Compliance, Information Security, and Architecture review teams

**Audience:** the people your buyer's team will hand our materials to for self-qualification. Pharma QA systems leads, CME outcomes directors, information-security architects, enterprise LMS integrators. This doc is what they read instead of scheduling a second meeting.

**Honest framing:** every answer below names what SWS *can* demonstrate today versus what is aspirational. Compliance-by-overclaim is how vendors get into audit trouble — we'd rather you know exactly what you're buying. If an answer says "we cannot demonstrate this today," that is the honest current state and we are not hiding it.

**Verify every claim against:** the public repo at `https://sws-attention-proofs.web.app`, the live JWKS at `https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json`, `src/sdk/*`, and the 270+-test suite across 45 suites (`npm test`).

---

## A — Architecture & protocol basics

### A1. What is the SWS attention receipt?

A receipt is a **W3C Verifiable Credential** (VC Data Model 2.0) serialized as an **Ed25519-signed JWT** (RFC 8032 EdDSA, RFC 8037 JOSE-blessed). It carries:

- The subject ID (a pseudonymous DID, no PII)
- Engagement metrics (duration, composite score, quality tier)
- Seven independent attestation layers (see A2)
- A content-hash chain that makes the receipt tamper-evident
- Optional timestamp proofs: RFC 3161 TSA token and/or OpenTimestamps Bitcoin anchor

Any party holding the signed JWT + our public JWKS can verify the receipt offline in their own browser, in Node, in Python, or in Go. No SWS server involvement.

### A2. What are the seven layers?

1. **Environmental gate** — FingerprintJS BotD v2 browser-fingerprint verdict (`proof/sdk/environmental-gate.js`)
2. **Behavioral composite** — 20 motor + keystroke + decision signals (`src/sdk/attention-protocol.js:1166`)
3a. **Composition integrity** — typing-vs-paste keystroke-dynamics verdict (`proof/sdk/composition-integrity.js`; arxiv 2511.12468)
3b. **Honeypot canary** — invisible prompt-injection trap (`proof/sdk/honeypot-canary.js`)
4. **Consent attestation** — GDPR Art. 7 / CCPA §1798.120 opt-in record
5. **Ed25519 signature** — EdDSA JWT over the whole credential (`src/sdk/attention-signer.js`)
6a. **OpenTimestamps Bitcoin anchor** — SHA-256 receipt hash published to free public calendar servers, which batch into a Bitcoin transaction
6b. **RFC 3161 TSA token** — Microsoft Authenticode / Adobe PAdES / eIDAS-compatible commercial timestamp

Plus a **receipt-wide gated composite** (`src/sdk/receipt-composite.js`, shipped 2026-04-21) that aggregates the above into one defense-in-depth final score with enumerable gate provenance.

### A3. Where is the signing key held?

In our server's environment variable `SWS_SIGNING_KEY` (32-byte Ed25519 seed, hex-encoded). On Firebase Functions it is stored as a secret; on Google Cloud Run it is an environment variable. The key is NEVER transmitted off the server; only the public key is published at `/.well-known/attention-pubkey.json`. Key rotation is supported via JWT `kid` headers and JWKS multi-key publication — receipts signed under an old key remain verifiable via the retained public key in the JWKS.

### A4. What does a buyer need to verify a receipt?

The JWT string and our public JWKS URL. That's it. No account, no API, no server, no credentials. A quick example in Node:

```js
const signer = require('@sws/attention-signer');
const jwks = await fetch('https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json').then(r => r.json());
const result = await signer.verifyJwt(jwt, jwks.keys[0]);
// result = { valid: true, header, payload }
```

Same pattern works in browsers via Web Crypto, or in Python via `cryptography`, or in Go via `crypto/ed25519`.

### A5. What does the receipt NOT claim?

Read `docs/prospect-dossiers/11-pfizer.md` and `SEVEN_LAYER_DEEP_DIVE.md` §10 for the full list. Short version:
- Identity of the learner (we prove a human was there; we don't prove *which* human)
- Webcam/voice/biometric evidence (we collect none)
- Legal compliance certification (we produce audit artifacts; a legal/QA team certifies)
- Future behavior prediction (the receipt is about *this* session only)

---

## B — Privacy, PII, and data handling

### B1. Does SWS collect PII?

No. We do not collect names, emails, dates of birth, government IDs, device IDs, IP addresses (not logged), browser fingerprints beyond BotD's automation-detection output, or geolocation. The `credentialSubject.id` in a receipt is a synthetic DID derived from a pseudonymous session user ID — not linkable to any real-world identity unless the integrator chooses to map it on their side.

### B2. Does SWS record what the user types or reads?

No. Composition integrity (Signal 21) measures the *statistics* of typing — paste-burst count, backspace ratio, keystroke-interval coefficient of variation — without storing any characters. The receipt fields are `chars_observed: <count>`, `paste_burst_count: <n>`, etc. The actual text never leaves the user's browser.

Reading is not captured either — scroll position, dwell time, and section-boundary events are logged as timings, not as quoted content.

### B3. Does SWS use a webcam or microphone?

No. The product will not request camera or microphone permissions under any circumstance. This is a deliberate architectural boundary — our "no proctoring invasion" pitch depends on it.

### B4. Is the product GDPR/CCPA/COPPA compliant?

The product carries a **GDPR Article 7 / CCPA §1798.120-aligned consent attestation** in every receipt (`credentialSubject.consentAttestation`). The receipt records: categories granted, timestamp of grant, consent-UI version, policy URL. That satisfies the documented-consent requirement.

Full GDPR/CCPA/COPPA *compliance* is a legal determination by your own counsel based on how you integrate — specifically, how your UI presents the consent request and how you handle data-subject-access / right-to-erasure requests on your side. Our scaffolded consent UI in `proof/sdk/consent-ui.js` is a starting point, not a legal product.

### B5. Where is data stored?

Firestore (Google Cloud, US-region by default; multi-region available). The stored records are session receipts with the fields described in A2 — no PII, no content, no stored user text. Retention is configurable by integrator. For pilots we can configure a 30-day TTL on raw session rows and keep only the signed receipts indefinitely.

### B6. Is data ever used to train machine-learning models?

No. The 20 behavioral signals are **deterministic formulas** from published papers (Fitts, Hick, Lacquaniti-Terzuolo-Viviani, Van Orden, Shannon). We do not run a classifier that was trained on user data. The gated composite (`src/sdk/receipt-composite.js`) is a deterministic min-cap over named detectors. No model weights to update. No inference drift.

---

## C — 21 CFR Part 11 (pharma / FDA-regulated training)

### C1. Is SWS "Part 11 validated"?

No — and no vendor can honestly claim that about itself. Part 11 validation is a *system*-level determination by your QA team; it requires your integration context, your training content, and your procedural controls. What SWS provides is a **TECH/MIXED/PROC mapping** (see `docs/COMPLIANCE_MATRIX.md` and the `/part-11.html` live page) that enumerates every Part 11 clause and marks which responsibility layer covers it.

### C2. Which Part 11 clauses does SWS address directly?

- **§11.10(a) — accurate and complete copies:** ✓ receipt is a signed, tamper-evident record
- **§11.10(b) — record protection / retrieval:** ✓ receipts self-authenticate against public key; retrieval is a read against Firestore + JWKS fetch
- **§11.10(c) — protection to enable retrieval throughout retention period:** ✓ Ed25519 keys and JWKS are long-lived; RFC 3161 / OpenTimestamps anchor the exact-date claim
- **§11.10(e) — audit trail:** ✓ every session record carries creation time, duration, integrity hash chain; receipts are immutable after signing
- **§11.50 — signature manifestations:** ✓ issuer identity + session subject + signed assertion type encoded in the VC
- **§11.70 — signature-record linking:** ✓ Ed25519 signature is over the receipt hash, binding signer to record
- **§11.200 — electronic signature components and controls:** partial; this is about operator controls at YOUR enterprise. Our receipt provides the *signed artifact*; your SSO/MFA provides the *operator authentication*.

Not addressed by us (these are YOUR side): §11.10(d) limiting access to authorized individuals, §11.100-series signature-unique-to-person requirements. Your LMS or IAM provides those.

### C3. Would an FDA inspector accept a SWS receipt as evidence of training completion?

The receipt itself is a **defensible evidence artifact**; whether it *alone* satisfies an inspector depends on your SOPs around how the receipt is produced, stored, and retrieved during an audit. SWS's position: the receipt is the strongest form of evidence you can produce for the *engagement* part of Part 11. It does not replace your SOP, but it converts an inspector challenge of "prove this training wasn't click-through" from a procedural argument into a cryptographic fact.

### C4. Does SWS have a 483 / warning-letter history?

No — we are a new-market-entry vendor. No prior FDA inspection, no 483s, no consent decrees. This is both a fact and a caveat: we have no track record. Pilot-first is the right path.

---

## D — Security posture

### D1. SOC 2 / ISO 27001 / HIPAA / FedRAMP status?

Not certified yet. This is the most common blocker for larger-enterprise procurement. What we can provide:

- `docs/SECURITY_ARCHITECTURE.md` — threat model, data flow, key management, access controls
- `docs/COMPLIANCE_MATRIX.md` — per-clause mapping with honest TECH/MIXED/PROC labels
- Pilot-phase tighter scoping — we can pilot on one training module behind your existing IT-security wrapper and let you produce the audit artifact as a byproduct of the pilot
- Compliance maturity timeline: SOC 2 Type I scoping starts post-pilot-#1; Type II after 6–12 months of operation

### D2. Where is the source code hosted?

Public GitHub: `sws-attention-proofs` (frontend + SDK) and project directory. The patent (SWS-PROV-001, USPTO filed 2026-03-17) is the moat, not code obscurity. Code public + patent filed is the deliberate architecture.

### D3. Dependency footprint? Supply-chain risk?

Signing pipeline uses Node's built-in `crypto` (OpenSSL-backed). No external crypto dependencies for the receipt signature. The vendored libraries we do use:

- `@fingerprintjs/botd` (MIT, 11 KB) — environmental gate
- `javascript-opentimestamps` (LGPL, Bitcoin anchoring)
- `jsonwebtoken` / internal JWT code — EdDSA via Node crypto
- `puppeteer` — dev/test-only, not shipped to production
- `firebase-admin` — Firestore client

Full SBOM available on request.

### D4. Known CVEs? Audit history?

**2026-04-21 internal security audit** closed 9 findings — all fixed in same-day commits. Findings covered input sanitization in Firebase Functions, TSA SSRF allowlist, credential-compress zip-bomb guard, JWT replay-audit verification, honeypot word XSS guard, server-side hardening (constant-time auth compare, rate limits, plan-escalation block), consent UI CSS-injection guard, and public verifier-page XSS. See `git log bba04db..7c8c025` for per-commit detail.

63 of the 270+ regression tests are explicit security-regression tests mapped to the audit findings.

No externally-reported CVEs to date (no public disclosures, no third-party audits yet).

### D5. Incident response?

Not formalized yet. This is honest. For pilot-stage, incident response is "Stephen is on-call 24/7" and that's actually true. Post-pilot we formalize.

---

## E — Cryptography detail

### E1. Why Ed25519? Is post-quantum on the roadmap?

Ed25519 chosen for: deterministic signatures (no nonce-reuse CVE), 64-byte fixed signature size (QR-friendly), RFC 8037-blessed for JWT, faster than ECDSA-P256, no curve-parameter choices. See `SEVEN_LAYER_DEEP_DIVE.md` §6 for the full alternatives matrix (ECDSA, RSA, Dilithium, Falcon, BLS considered).

Post-quantum migration path is designed-in: JWT `alg` header + JWKS multi-`kid` support means we can issue new-algorithm receipts under a new `kid` while old-algorithm receipts remain verifiable. When NIST's Dilithium / Falcon hit enterprise adoption (expected 2027–2030), we migrate. 2.5–4 KB post-quantum signatures will force a QR-compressibility change; we'll handle it then.

### E2. How is the receipt hash computed?

SHA-256 over a canonical JSON serialization of the receipt *before* the outer signature is added. The hash appears as `credentialSubject.attentionProof.receiptHash` *inside* the signed VC payload — which means tampering with any field invalidates both the signature AND the hash-chain check. Defense-in-depth.

### E3. Is the OpenTimestamps anchor verifiable without a Bitcoin node?

Mostly. An SPV client (or any block-explorer API like Blockstream or Mempool.space) can verify the block-height claim. For fully air-gapped verification you need a Bitcoin full node (~600 GB). The proof file (OTS upgrade) is self-contained once you have it — you run `ots verify` locally against the proof + the block header.

### E4. Does SWS touch Bitcoin (hold, send, receive)?

**No.** We publish SHA-256 hashes to free public OpenTimestamps calendar servers. Those servers batch many hashes into one Bitcoin transaction and pay the network fee themselves. SWS holds zero crypto assets, has no wallet, no on-chain transactions attributable to us. We use Bitcoin as a public notary, not as a currency.

### E5. What if the RFC 3161 TSA is compromised?

Rotate to a different TSA. Our `src/sdk/attention-tsa.js` accepts a configurable `tsa_url`; pilots can point at FreeTSA, DigiCert, Sectigo, GlobalSign, Entrust, or a self-hosted TSA. A compromised TSA issuing backdated tokens would be detected by the OpenTimestamps anchor (Bitcoin-anchored timestamp is independent of the TSA). Two-anchor redundancy is the design answer.

---

## F — Integration (LMS, xAPI, OpenBadges)

### F1. Can our existing LMS consume SWS receipts?

Almost certainly yes. Every receipt serializes as:

- **xAPI 1.0.3 statement** (`src/sdk/attention-xapi.js`) — drops into any xAPI-capable LRS (Moodle, Canvas, Articulate 360, Cornerstone, Degreed, EthosCE, Cadmium, D2L Brightspace, SAP Learning Hub).
- **OpenBadges 3.0 AchievementCredential** (`src/sdk/attention-openbadge.js`) — LinkedIn-portable; ingestable by Credly, Accredible, Sertifier, BCdiploma.
- **Raw W3C VC-JWT** — for any system implementing the VC Data Model 2.0.

### F2. What does integration look like?

Single script tag on the training page + one POST endpoint the LMS hits to fetch the signed receipt after session completion. See `docs/API_SPECIFICATION.md` for the endpoint contract. Pilots run behind your own IT wrapper; we do not require direct access to your LMS backend.

### F3. Can we self-host?

Not yet offered as a productized deployment, but architecturally yes: the signing key, JWKS, and Cloud Function handlers are ~500 LOC of Node and can be deployed to any Kubernetes cluster or serverless-functions vendor. For a named pilot with self-hosting requirement we'd scope that as part of the pilot. Cost would be $5–15K in integration engineering on our side.

---

## G — Performance & scale

### G1. How does performance degrade at scale?

The browser-side SDK (attention measurement) is constant-cost per session — no scaling concern on the client. The server-side receipt signer is a stateless single-round Ed25519 signing operation; sustained throughput of thousands of signings per second on a single VM. Firestore scales to the write rate. Bitcoin anchoring is per-receipt but free.

Realistic concurrency: 10,000 simultaneous learner sessions handled by a single Cloud Run instance at ~$20/month. Pilots operate well below this.

### G2. Session duration limits?

Recommended: 2–10 minutes per session. Over 30 minutes and the behavioral composite's signal quality plateaus (most behavioral signals saturate after ~5 min of engaged activity). Training modules longer than 30 min should be split into chunks with per-chunk receipts, then chain-linked at the receipt level.

### G3. Offline support?

Partial. The SDK functions offline for the measurement period; the receipt signing requires a round-trip to our Cloud Function (or your self-hosted signer). Post-signing verification is fully offline. For air-gapped training environments we offer a self-hosted signer mode (see F3).

---

## H — Commercial / pilot terms

### H1. How do pilots work?

60-day pilot on one named training module. Zero-dollar or single-digit-thousand dollar pilot fee depending on integration depth. Joint case study produced during the pilot is part of the agreement — you get the receipts and audit data; we get the co-marketed case study for future RFPs. Post-pilot conversion to paid subscription based on learner volume.

### H2. Who is Stephen Furpahs and what is the team?

Stephen Furpahs is the director, sole inventor (patent SWS-PROV-001), and founder of SWS Strategic Media LLC. He runs an AI-augmented engineering operation — the workflow is specification + review + test + approval, with Claude-based tooling as the engineering team. Every commit in the public repo is code Stephen reviewed, tested, and approved. This is not a "we built it from ChatGPT" product; it is a directed specification-first engineering operation with a patent-filed spec as the moat. Team size today: one plus tooling. Pilots at pilot-stage scale fine for that footprint; growth plan is deterministic post-first-revenue.

### H3. What happens if SWS goes out of business?

The receipts remain verifiable forever — the JWKS is a static file you can mirror to your own S3 bucket; the signatures are mathematical facts that do not expire when our DNS does; the Bitcoin anchors are in Bitcoin's chain, independent of us. Customer data (Firestore) exports as JSON in a standard format; we will provide a full export under any sunset scenario. This is deliberately engineered — part of the "tamper-evident, not trust-us" architecture.

---

## I — What SWS cannot do today

Any of the following, honestly:

- **SOC 2 Type II / ISO 27001 / FedRAMP certified operation.** Not yet.
- **A published benchmark of honeypot-canary detection rate against real-world LLM adversaries.** Next-quarter work; see `SEVEN_LAYER_DEEP_DIVE.md` §4.
- **A fully statistically-recalibrated behavioral composite.** The gated composite (shipped 2026-04-21) produces the 0.27+ bot/human gap today; further recalibration against the Balabit mouse-trajectory dataset is on the roadmap as additive.
- **A large real-world human corpus.** Current N=1 (founder). N≥6 target before any formal benchmarking claim.
- **Customer references.** We are pre-pilot-#1. Our case studies will be jointly produced with our first paying pilots.
- **Insurance / E&O policy.** Not yet; carried as founder liability under the LLC. Negotiable as part of a pilot-structured MSA.

If any of these are deal-breakers for your procurement, tell us which one — we would rather know that now than six calls in.

---

**Last updated:** 2026-04-29 (test count + 7-layer wording reconciled to current state). Each answer cross-verifiable against the public repo, the live site, and the 270+-test suite across 45 suites.
