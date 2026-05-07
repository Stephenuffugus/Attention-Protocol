# Data Protection Impact Assessment (DPIA)
## SWS Proof-of-Attention Protocol

**Prepared for:** Customer privacy / data-protection reviewers performing GDPR Art. 35 / UK GDPR / CCPA risk assessments before integration.
**Vendor:** SWS Strategic Media LLC · `stephenfurpahs@gmail.com` · solo founder
**Product:** SWS Proof-of-Attention Protocol (cryptographic attention receipts)
**Provisional patent:** USPTO filed 2026-03-17 · SWS-PROV-001
**Production environment:** Firebase project `sws-attention-proofs` (US, multi-region)
**Authoritative cross-references:** `docs/SECURITY_ARCHITECTURE.md` · `docs/technical-faq.md §B` · `docs/COMPLIANCE_MATRIX.md` · `docs/architecture-1pager.md`
**Date prepared:** 2026-05-05 · **Review cadence:** annually or on material architecture change

---

## 1. Purpose and scope

### 1.1 What this DPIA covers

This document assesses the data-protection risk of integrating the SWS Proof-of-Attention SDK into a customer's web property (e.g., a CME activity, a survey, a training module) for the purpose of producing a cryptographic receipt that attests a real human paid attention to the displayed content.

It covers:
- The browser-side SDK (`src/sdk/attention-protocol.js` and modules in `proof/sdk/`)
- The signing service (`signReceipt` Cloud Function)
- The public verification service (`publicKey` endpoint, `/verify.html`)
- The optional anchoring services (RFC 3161 TSA tokens, OpenTimestamps Bitcoin anchor)

It does NOT cover:
- The customer's own LMS, IAM, SSO, or content delivery (separate DPIA on the customer side)
- Any downstream business-intelligence the customer derives from receipts on their own infrastructure

### 1.2 Why a DPIA is appropriate (Art. 35 trigger analysis)

GDPR Art. 35 requires a DPIA where processing "is likely to result in a high risk." The SWS protocol does **not** meet the conventional Art. 35 §3 triggers (no automated decision-making with legal effect, no large-scale special-category data, no systematic monitoring of public spaces). Nevertheless, because the product is described to learners as "attention measurement," many privacy reviewers will treat behavioral telemetry as borderline-sensitive even when no identifiers are collected. This DPIA is provided proactively to facilitate that review.

---

## 2. Description of the processing operation

### 2.1 The processing in plain language

A learner opens a web page (the customer's CME activity, survey, or training module) in their normal browser. While the learner reads, scrolls, types a reflection, and clicks through the content, the SWS SDK records timing patterns of those interactions in memory. At the end of the session, the SDK computes a deterministic set of summary statistics (the "23 behavioral signals"), bundles them into a JSON object, sends that JSON to the SWS signing service, and receives back a cryptographically-signed receipt. The receipt is stored in the customer's record system as evidence the learner engaged with the content.

### 2.2 Lawful basis (GDPR Art. 6)

Two paths, customer's choice:

- **Art. 6(1)(b) — performance of a contract:** the learner has enrolled in CME or training and the receipt is part of the service. This is the typical CME / training-completion path.
- **Art. 6(1)(a) — explicit consent:** every receipt embeds a `credentialSubject.consentAttestation` block recording (a) categories granted, (b) timestamp, (c) consent-UI version, (d) policy URL. This is the typical advertising / market-research path.

Where the customer integrates under Art. 6(1)(a), the consent UI scaffolding in `proof/sdk/consent-ui.js` provides a starting point. The customer's counsel determines whether the consent meets Art. 7 standards under their specific UI implementation.

### 2.3 Data subjects

End users of the customer's web property — typically physicians, nurses, survey respondents, or training learners. The SWS protocol has no awareness of professional role, license number, employer, or any other identity attribute; it operates on whoever loads the page.

### 2.4 Categories of data processed

| Category | Collected? | Detail |
|---|---|---|
| Direct identifiers (name, email, phone, address) | **No** | The protocol never asks for these and never stores them. |
| Government IDs (NPI, license #, SSN, passport) | **No** | Out of scope by design. |
| Online identifiers (IP address, cookies, advertising IDs) | **No** (see §3.2) | IP is observed by the underlying TLS stack but not logged by SWS. No SWS cookies. No advertising IDs. |
| Device fingerprints | **Limited** | The environmental gate uses BotD's open-source automation-detection vector. No persistent fingerprint hash is stored; only the boolean "headless / automated" verdict is recorded in the receipt. |
| Geolocation | **No** | No IP-to-geo, no GPS, no Wi-Fi triangulation. |
| Webcam / microphone / camera | **No** | The product will not request camera or microphone permissions under any circumstance. Hard architectural boundary. |
| Biometrics (facial, voice, gait, iris) | **No** | None of the above sensors are accessed. |
| Special-category data (Art. 9) | **No** | Health, racial, religious, political, sexual orientation, trade-union membership, genetic — none collected. |
| Children's data (under 13 / under 16 EU) | **N/A** | The protocol does not ask the user's age. Customer-side responsibility to gate underage access; if integrator deploys to a minor population, COPPA-eligible posture is supported (no PII collected by construction). |
| **Behavioral telemetry** (the actual data) | **Yes** | See §2.5 below. |
| Content the user typed | **No** (statistics only) | Composition Integrity (Signal 21) measures *statistics* of typing — paste-burst count, backspace ratio, keystroke-interval coefficient of variation — without storing characters. The actual text never leaves the user's browser. |
| Content the user read | **No** (timings only) | Scroll position and section-boundary events are logged as timings (`section_id_3 entered at t=42.3s, exited at t=88.1s`). The text being read is not transmitted. |

### 2.5 The 23 behavioral signals — what they actually are

The signals are **summary statistics** computed in the browser, not raw event streams:

- **Timing-family (5):** timing entropy, timing variance, micro-pause distribution, sustained-attention coherence, reaction-time stability
- **Motor-control family (5):** Fitts's-Law compliance, mouse curvature index, cursor jerk, velocity profile, two-thirds power-law residual (mouse only — null on touch devices)
- **Cognitive-decision family (3):** Hick's-Law decision time, decision-cost variance, complexity-aware reaction time
- **Reading family (3):** reading speed, reading coherence, scroll-velocity profile
- **Touch family (3):** touch pressure variance, touch-area variance, multi-touch coordination (mobile only — null on desktop)
- **Engagement family (4):** active window-focus, hover-dwell distribution, scroll-event density, micro-pause-to-action ratio

Each signal is a single numeric value in [0, 1]. The full set, plus three diagnostic "is the signal even applicable to this device" booleans, comprise the receipt payload. The mathematical definitions come from peer-reviewed literature (Fitts 1954, Hick 1952, Lacquaniti-Terzuolo-Viviani 1983, Gilden 2001, Shannon 1948) — the protocol's behavior is **deterministic**, not learned. There is no model trained on user data; there are no weights to drift.

### 2.6 Recipients of the data

| Recipient | Role | Inheritance / safeguard |
|---|---|---|
| **SWS Strategic Media LLC** | Receipt signer | Solo-founder operation, US (Ohio). Signing key in Google Secret Manager, never transmitted off Cloud Functions runtime. |
| **Google Cloud / Firebase** | Hosting, Cloud Functions runtime, Firestore, Secret Manager, anonymous auth | SOC 2 Type II, ISO 27001, ISO 27017/18, FedRAMP High, HIPAA-eligible (BAA available). |
| **FingerprintJS BotD** | Environmental-gate dependency (runs client-side, no transmission) | MIT-licensed open-source library, 11 KB. **No data leaves the browser through this path.** |
| **OpenTimestamps calendars** (optional, customer opt-in) | Bitcoin anchoring of receipt hash | Public calendar servers; the receipt hash only — no PII, no behavioral data, no content. |
| **RFC 3161 TSA** (optional, customer opt-in) | Commercial timestamp authority | Customer's choice of DigiCert / Sectigo / GlobalSign. Receipt hash only — same as OpenTimestamps. |

There are **no other sub-processors.** No analytics SDKs in the protocol path. No CDN tracking. The SDK has zero npm dependencies — pure browser-native APIs.

---

## 3. Necessity and proportionality

### 3.1 Could the purpose be achieved with less data?

The purpose — "produce evidence that a real human paid attention" — requires *some* signal. The protocol's design intentionally minimizes that signal to **summary statistics of timing patterns.** Nothing about the user's content, identity, location, or device fingerprint is required to compute the 23 signals. Less-data alternatives such as "trust the click-through" or "self-attestation" do not satisfy the regulator-facing evidence requirement that motivated this product (FDA Part 11 §11.10(e), ACCME Standards for Integrity, Pfizer IME RFP "measurement of learner progression").

### 3.2 IP address handling

The TLS stack used by Firebase observes the client's IP at connection time, as is true for any web service. SWS does not log, store, or include IP addresses in receipts. Firebase's underlying request logs (Cloud Logging) may retain IP for default operational windows (typically 30 days for Cloud Functions execution logs) under Google's standard retention policy, inherited from the Google Cloud SOC 2 Type II attestation. The customer can request a `cloudLogging: false` configuration for stricter scopes (post-pilot work; not yet in default).

### 3.3 Retention

| Data | Retention | Purpose |
|---|---|---|
| In-memory signal computation | Lifetime of the browser tab | Required for SDK operation; never persisted |
| Firestore session row (full event log + signed receipt) | **30-day TTL** by default; configurable per integrator | Operational debugging + buyer-side audit retrieval |
| Signed receipt (JWT + signature) | Indefinite, customer-controlled | The receipt IS the evidence artifact; the customer owns retention policy |
| Firebase Cloud Logging (request logs, IP-bearing) | Google default ~30 days | Inherited; SWS does not extend or query |
| Public JWKS endpoint | Indefinite | Required to verify historic receipts; static file, mirror-able |

Receipts remain verifiable forever even if SWS goes out of business, since (a) the JWKS is a static file mirrorable to any web host, and (b) Ed25519 signatures are mathematical facts. This durability is itself a privacy protection — it means the receipt is not coupled to ongoing SWS data-processing.

### 3.4 International transfers

Default Firestore region: US multi-region. Customers requiring EU-residency can request a `eur3` (Belgium / Netherlands / Finland) deployment scope; this is a Firebase-side configuration and inherited from Google's SCC-compliant data-transfer framework. Standard Contractual Clauses (Module 2 — controller-to-processor) apply where the customer is established in the EU/UK. Cross-Atlantic transfers operate under the EU-US Data Privacy Framework; SWS will sign an SCC addendum on customer paper as part of the DPA.

---

## 4. Risk assessment

### 4.1 Risks to data subjects

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Re-identification from behavioral signals alone** | Low | Low | The 23 signals are summary statistics in [0, 1] computed from minutes of interaction. Without any direct identifier or persistent fingerprint to anchor the data to, behavioral-only re-identification has been studied at length (Bojinov et al. 2014; Eberz et al. 2017) and requires either large per-user training sets or fusion with separate identifiers — neither of which SWS produces. |
| **Linkage attack via session-ID correlation** | Low | Medium | Each session generates a fresh `sessionId` and a fresh anonymous Firebase auth UID per browser. Customer can choose to map their internal user ID to the session at write time (their data, their decision); SWS does not require it. |
| **Misuse of receipt for surveillance** | Low | Medium | The receipt does not record what the user read or typed. A receipt cannot reveal the *content* of the session, only *that the session occurred and the engagement statistics resembled a real human.* Customer's UI integration determines what subjects know about the assessment. |
| **Aggregation across multiple integrators** | Very low | Low | Each customer signs their own SWS contract and has their own receipt store. SWS does not pool customer data. There is no SWS data lake. |
| **Re-purposing of data for ML training** | None | N/A | The 23 signals are deterministic formulas from published literature. SWS does not train models on user data. There is no classifier with weights to update. (`docs/technical-faq.md §B6`) |
| **Webcam / microphone / proctoring drift** | Architecturally impossible | N/A | The SDK does not request `getUserMedia()` permissions under any circumstance. This is enforced at the code level — see `src/sdk/attention-protocol.js`, no `navigator.mediaDevices` reference. |
| **Children's-data exposure (under-13)** | Customer-controlled | Medium | SWS does not ask for age and is COPPA-safe by construction (no PII collected). If the customer's audience includes minors, gating is the customer's responsibility. |
| **Vendor failure → loss of verification** | Low | Low | JWKS is a static file, mirrorable to any S3 bucket. Signatures are mathematical facts. Receipts already issued remain verifiable forever even if SWS ceases operation. |

### 4.2 Risks to the customer (data controller)

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Regulator challenges receipt as evidence** | Medium | High | The receipt is layered (7 attestation layers including environmental, behavioral, composition, honeypot, consent, signature, anchoring). A regulator's challenge to one layer does not invalidate the others. Customer can produce the full receipt structure plus the published JWK for offline verification. |
| **Buyer claims SWS storage is insufficient** | Low | Low | Firestore inherits Google Cloud's SOC 2 Type II + ISO 27001 + ISO 27017/18. Customer can request EU residency. Encryption at rest (AES-256) is default. |
| **Customer assumed SOC 2 / HIPAA BAA** | Medium | High | SWS is **pre-revenue and not yet SOC 2 audited.** This is disclosed up-front. The compensating controls are: (a) inheritance from Firebase's audit (b) public source code on GitHub for direct buyer audit (c) pilot-only deployment until vendor maturity catches up. SOC 2 Type I targeted post-pilot-#1; HIPAA BAA available from Firebase, not from SWS until entity formalization. |
| **Audit-trail challenge from FDA / ACCME** | Low | Medium | Receipts carry creation timestamps, integrity hash chains, and Ed25519 issuer attestation. They are immutable after signing. The 21 CFR Part 11 mapping in `docs/COMPLIANCE_MATRIX.md` enumerates each clause and labels TECH/MIXED/PROC. |

### 4.3 Compensating controls already in place

- **Zero PII collection by design:** removes the largest class of GDPR risk at the source.
- **No content storage:** removes copyright / IP-leakage concerns and reduces breach blast-radius to "no PII anyway."
- **Receipt hash anchored to public infrastructure** (optional Bitcoin / RFC 3161): tamper-evident over decades without ongoing SWS involvement.
- **Open-source SDK:** customer's privacy team can audit the actual data flow, not just trust documentation.
- **Hostile-review hardening:** seven rounds of adversarial agent review (security, statistics, business, code, competitive, legal, SRE, UX, crypto, adversarial bot designer) plus a 2026-05-07 production-tightening pass (R8) closed approximately 90 findings before any customer onboarding. Round 7 declared the engineering hardening cycle converged; R8 closed five same-day production-correctness findings surfaced while empirically substantiating the methodology doc's reliability claim.
- **Server-side composite recompute** (the "wall"): re-derives the composite server-side from the raw event log, preventing client-side score forgery. Bypass cost ~$5–20K/mo + 200–400 engineering hours per Round-2 adversarial-bot-builder estimate.

---

## 5. Data-subject rights

| Right | How SWS supports it |
|---|---|
| **Art. 13 — information at collection** | Customer's UI is responsible for the notice; `proof/sdk/consent-ui.js` provides a scaffolded notice the customer can adopt or replace. |
| **Art. 15 — right of access** | Because no PII is collected, there is no SWS-side mapping from a real-world identity to a record. The customer holds any such mapping on their own infrastructure and answers SAR requests from there. |
| **Art. 16 — rectification** | Receipts are immutable by design (any modification invalidates the signature). If a session record is contested, the integrity is verifiable; the *interpretation* is customer-side. |
| **Art. 17 — erasure** | Firestore session rows are deletable on request via `scripts/inspect-session.js` + standard Firestore delete. The signed receipt itself, once issued and stored on the customer's side, is the customer's to retain or delete per their retention policy. |
| **Art. 18 — restriction of processing** | Customer can disable the SDK on a per-session or per-user basis via their consent UI; no processing occurs without `init()`. |
| **Art. 20 — data portability** | Receipts are self-contained JWTs in industry-standard W3C Verifiable Credential shape. They are portable by definition. |
| **Art. 21 — objection** | Customer's consent UI is the objection mechanism; SWS honors absence of consent at the integration layer. |
| **CCPA §1798.105 — deletion** | Equivalent to Art. 17 above. |
| **CCPA §1798.115 — disclosure** | SWS does not "sell" or "share" data in the CCPA sense. No advertising IDs, no third-party data exchange. |

---

## 6. Conclusion and residual risk

### 6.1 Residual risk rating

**LOW** for the data subject. The combination of (a) zero direct identifiers collected, (b) zero content stored, (c) deterministic-formula computation with no model training, (d) immutable receipts not coupled to ongoing SWS processing, and (e) inheritance from Firebase's audit envelope produces a privacy posture stronger than the typical web-analytics integration.

**MEDIUM** for the customer-controller, driven primarily by SWS's pre-SOC-2 vendor-maturity stage rather than by the protocol design itself. This is mitigated by pilot-only deployment scope, public source-code audit-ability, and a compliance roadmap targeted at SOC 2 Type I post-pilot.

### 6.2 Conditions for low-risk customer integration

This DPIA's residual-risk conclusion is conditional on:

1. The customer's UI presents a clear notice of behavioral measurement before SDK initialization
2. The integration uses Art. 6(1)(b) (contract) or Art. 6(1)(a) (explicit consent) as the lawful basis, **not** legitimate-interest balancing
3. The customer does not link the receipt back to a real-world identifier without an independent lawful basis for that linkage
4. The customer accepts SWS's pre-SOC-2 status with a contractual risk-acceptance memo or equivalent
5. The customer operates the receipt-storage retention policy on their own infrastructure (SWS does not retain customer receipt copies after the 30-day Firestore TTL by default)

### 6.3 When this DPIA must be revisited

- Material change in collected data categories (none currently planned)
- Introduction of any ML/inference component (none planned; the deterministic-formula architecture is core to the privacy claim)
- Move to non-Firebase infrastructure
- SOC 2 / ISO 27001 audit completion (favorable change — would upgrade vendor-maturity rating)
- Entity formalization (Delaware C-corp) and DPA / BAA execution by SWS directly (favorable change)

---

## 7. Signing party

This DPIA is prepared by SWS as the data processor. The customer, as the data controller, performs the formal Art. 35 assessment under their own internal procedure and can adopt this document as supporting evidence.

For questions or to request modifications scoped to a specific integration:
**Stephen Furpahs · `stephenfurpahs@gmail.com`**

---

**Document version:** 1.0 · **Effective date:** 2026-05-05 · **Next review:** 2027-05-05 or upon material change
