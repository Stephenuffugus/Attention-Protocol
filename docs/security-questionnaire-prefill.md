# SWS Attention Protocol — Security Questionnaire Pre-Fill

**Vendor:** SWS Strategic Media LLC (Ohio LLC; formation-state confirmation pending)
**Product:** SWS Proof-of-Attention Protocol (cryptographic attention receipts)
**Stage:** Pre-revenue, patent-pending (USPTO provisional SWS-PROV-001 filed 2026-03-17), deployed to production
**Production environment:** Firebase project `sws-attention-proofs` (US multi-region). Three Cloud Functions live since 2026-04-27: `signReceipt`, `publicKey`, `onSessionWritten`.
**Authoritative source documents:**
- `/workspaces/Attention-Protocol/docs/SECURITY_ARCHITECTURE.md`
- `/workspaces/Attention-Protocol/docs/technical-faq.md`
- `/workspaces/Attention-Protocol/docs/COMPLIANCE_MATRIX.md`

## How to read this document

This is a tier-2 procurement pre-fill. It maps the most-asked CSA CAIQ / CAIQ-Lite / Shared Assessments SIG questions to the actual implemented state of the SWS product as of 2026-04-29. Each answer is calibrated to what has shipped versus what is planned. Where a control is not in place, the status is `NOT YET` with a one-line note on planned timing. The source documents above are authoritative; if any answer here conflicts, the source documents win. The founder will sign formal DPA / BAA / MSA at contract — none are pre-templated, each is negotiated against buyer paper. The product is operated by a single director; there is no separate CISO, security team, or 24/7 SOC. Disclosed up-front rather than buried.

---

## 1. Audit, Assurance and Compliance (AAC)

### AAC-01 — Independent third-party audit
- **Status:** NOT YET
- **Answer:** No SOC 2 Type I or Type II, ISO 27001, ISO 27017, ISO 27018, HITRUST, or PCI-DSS audit has been performed against the SWS application layer. The product is pre-revenue and the cost of formal audit is post-pilot capital. SOC 2 Type I scoping is planned to begin after the first paid pilot; Type II window is 6–12 months of operation thereafter.
- **Evidence:** `docs/technical-faq.md` §D1, §I.

### AAC-02 — Inherited infrastructure attestation
- **Status:** IMPLEMENTED (inherited)
- **Answer:** We rely on Google Cloud / Firebase's SOC 2 Type II, SOC 3, ISO 27001, ISO 27017, ISO 27018, and HIPAA-eligible-services attestations for the underlying compute, storage, and network layers. Our Firestore database, Cloud Functions runtime, Secret Manager, and Cloud Storage all run inside that attested envelope. SWS-specific application-layer attestation is not yet pursued.
- **Evidence:** Google Cloud Compliance Reports Manager (https://cloud.google.com/security/compliance), `docs/SECURITY_ARCHITECTURE.md` §8.

### AAC-03 — Penetration testing
- **Status:** PARTIAL
- **Answer:** No paid third-party penetration test. Internal adversarial review is documented: seven hostile-review rounds between 2026-04-21 and 2026-04-28 produced approximately 93 findings, all closed in tracked commits. Round 2 adversarial bot-builder agent estimated post-wall bypass cost at $5–20K/mo plus 200–400 engineering hours. Paid pen-test planned post-pilot-#1.
- **Evidence:** Repo commit log `bba04db..7c8c025`; `docs/technical-faq.md` §D4.

### AAC-04 — Compliance roadmap and timeline
- **Status:** PARTIAL
- **Answer:** A per-clause `docs/COMPLIANCE_MATRIX.md` enumerates HIPAA, SCIF, SOC 2, GDPR, CCPA, COPPA, and FERPA posture. A separate per-clause 21 CFR Part 11 mapping marks each clause TECH (vendor-provided), MIXED (joint), or PROC (customer-provided). The matrix is the customer-facing contract for what we do versus what the integrator owns.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md`, `docs/technical-faq.md` §C2.

### AAC-05 — Audit logs available to customer
- **Status:** IMPLEMENTED
- **Answer:** Every signed receipt is itself an audit artifact: it carries creation timestamp, duration, integrity hash chain, issuer DID, and Ed25519 signature. Receipts are immutable after signing. Firestore session rows are append-only from the SDK's perspective; modifications would invalidate the receipt-hash chain.
- **Evidence:** `docs/technical-faq.md` §C2 §11.10(e), `docs/SECURITY_ARCHITECTURE.md` §5 (Data Tampering threat).

### AAC-06 — Right to audit
- **Status:** PARTIAL
- **Answer:** A right-to-audit clause is negotiable in the MSA. The product source code is public on GitHub (`sws-attention-proofs`); the patent is the moat, not code obscurity. Buyers may fork and audit the SDK and the Cloud Function source directly. Production runtime audit (e.g., live access to logs) is negotiable per pilot.
- **Evidence:** `docs/technical-faq.md` §D2.

---

## 2. Application & Interface Security (AIS)

### AIS-01 — Secure SDLC
- **Status:** PARTIAL
- **Answer:** Every commit lands in a public Git repository with a 270+ test suite across 45 suites that runs locally and is intended to run in CI. Internal hostile-review rounds gate major releases. There is no formal SDLC document, no separate security-champion role, no documented threat-modeling cadence beyond the hostile-review rounds. The founder reviews and approves every commit personally.
- **Evidence:** Public repo, test-suite output (`npm test`), `docs/technical-faq.md` §H2.

### AIS-02 — Input validation
- **Status:** IMPLEMENTED
- **Answer:** Cloud Functions perform schema validation, type checking, and range checks on every inbound payload. The 2026-04-21 internal audit closed input-sanitization findings in Firebase Functions; a constant-time auth comparator and rate limits were added in the same window. The wall (server-side composite recompute) re-derives every signal server-side so client-supplied composite scores cannot be trusted.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §3 Security row, `docs/technical-faq.md` §D4, `proof/functions/index.js` (`runWall`, `extractSessionMetrics`).

### AIS-03 — Output encoding / XSS
- **Status:** IMPLEMENTED
- **Answer:** The 2026-04-21 audit closed a public verifier-page XSS, a honeypot-word XSS guard, and a consent-UI CSS-injection guard. The verifier page is offline-only HTML/JS; it does not render server-supplied HTML. The receipt itself is a JWT; it is validated structurally before any field is rendered.
- **Evidence:** `docs/technical-faq.md` §D4.

### AIS-04 — API authentication and authorization
- **Status:** IMPLEMENTED
- **Answer:** B2B API uses an `X-SWS-API-Key` header carrying a 256-bit random key scoped to a single `client_id`. Rotation is in-place. Each authenticated user can only read/write their own Firestore vault (security rules). Webhooks are HMAC-SHA256-signed.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §3, §4.

### AIS-05 — API rate limiting
- **Status:** IMPLEMENTED
- **Answer:** Server-side rate limits were added in the 2026-04-21 hardening pass. Client-side burst protection and per-event-type daily caps complement the server-side limits. Anomaly detection escalates rate limits when a single UID generates a sudden hash-rate spike.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §3 Security row, `docs/SECURITY_ARCHITECTURE.md` §6.

### AIS-06 — Tamper evidence on outputs
- **Status:** IMPLEMENTED
- **Answer:** Every receipt is a W3C Verifiable Credential serialized as an Ed25519-signed JWT. The receipt hash (SHA-256 over canonical JSON, computed before the outer signature) is embedded inside the signed payload, so tampering with any field invalidates both the signature and the hash-chain check. Optional RFC 3161 TSA tokens and OpenTimestamps Bitcoin anchors provide independent timestamp evidence.
- **Evidence:** `docs/technical-faq.md` §A1, §A2, §E2.

---

## 3. Business Continuity Management & Operational Resilience (BCR)

### BCR-01 — Documented business continuity plan
- **Status:** NOT YET
- **Answer:** No formal BCP document exists. Single-founder operation; BCP is implicit in the architecture rather than written. Continuity-relevant facts: receipts remain verifiable forever via the public JWKS even if SWS goes out of business, since signatures are mathematical facts and the JWKS is a static file mirrorable to any S3 bucket. A formal written BCP is post-pilot work.
- **Evidence:** `docs/technical-faq.md` §H3.

### BCR-02 — Disaster recovery
- **Status:** PARTIAL
- **Answer:** Inherited from Firebase: Firestore is multi-region replicated by default; Cloud Functions are region-redundant; Secret Manager has Google's standard durability. SWS-side: source code is public on GitHub; signing keys are stored in Google Secret Manager (`SWS_DID_SALT`, `SWS_SIGNING_KEY`, `SWS_SIGNING_KID`); JWKS is a static file that can be re-served from any web host. No SWS-managed cold-site or formally-tested DR procedure exists.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8.

### BCR-03 — RTO / RPO targets
- **Status:** NOT YET
- **Answer:** No contractual RTO or RPO is committed today. Inherited Firebase availability is approximately 99.95% on Cloud Functions and 99.999% on multi-region Firestore. SWS-specific SLO is sketched in the SRE runbooks but is not yet contractual. Pilot SLAs would be negotiated against the buyer's specific uptime requirement.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8 (Firebase SOC 2 inheritance line); SRE runbooks in repository.

### BCR-04 — Backup and restoration
- **Status:** PARTIAL
- **Answer:** Firestore data is auto-replicated by Google Cloud. SWS does not run a separate scheduled backup beyond Google's defaults. Receipts have a customer-portable export path: signed JWTs can be downloaded by the integrator and stored anywhere; verification is offline against the published JWKS. No periodic restore-drill is performed today.
- **Evidence:** `docs/technical-faq.md` §H3.

### BCR-05 — Offline operation
- **Status:** IMPLEMENTED
- **Answer:** The browser-side measurement SDK runs entirely offline; localStorage is the canonical local cache. Cloud sync is optional and can be disabled (`enableCloudSync: false`). Verification of an existing signed receipt is fully offline — buyer needs only the JWT and the JWKS, which can be mirrored.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §2 (Air-Gapped Operation), `docs/technical-faq.md` §G3, §A4.

### BCR-06 — Vendor-failure escrow
- **Status:** PARTIAL
- **Answer:** No formal source-code-escrow agreement is in place yet. De-facto escrow is achieved by code-public-on-GitHub plus customer-held receipts plus public JWKS. If SWS dissolved tomorrow, every issued receipt would remain verifiable, and the SDK would remain forkable under its existing license. Formal escrow can be set up per pilot if the customer requires it.
- **Evidence:** `docs/technical-faq.md` §H3, §D2.

---

## 4. Change Control & Configuration Management (CCC)

### CCC-01 — Change management process
- **Status:** PARTIAL
- **Answer:** All changes flow through a single Git main branch with commit-level review by the founder. The 270+ test suite must pass locally before any commit lands. There is no separate CAB, no formal change-advisory ticketing, no segregation of developer and approver roles — single-founder operation.
- **Evidence:** Public repo commit history.

### CCC-02 — Production deployment controls
- **Status:** PARTIAL
- **Answer:** Production deploys to Firebase project `sws-attention-proofs` are gated by manual `firebase deploy` from the founder's workstation. There is no automated CI/CD pipeline pushing to production today. Secrets are stored in Google Secret Manager and not present in the repository or in any deploy artifact.
- **Evidence:** `firebase.json`, `firestore.rules`, `firestore.indexes.json` in the repository.

### CCC-03 — Separation of dev / staging / prod
- **Status:** PARTIAL
- **Answer:** Two distinct Firebase projects are used: `focus-grove-fffa8` (seed-site / earlier-product) and `sws-attention-proofs` (the current production protocol home). There is no formal staging tier; testing is local-test-suite + occasional preview-channel deploys.
- **Evidence:** Repo `.firebaserc`, user memory project_architecture_apr12.md.

### CCC-04 — Versioning and rollback
- **Status:** IMPLEMENTED
- **Answer:** Cloud Functions are versioned by Firebase; rollback is `firebase functions:rollback`. Git history provides full source rollback. JWKS supports multi-`kid` so that a key rotation does not invalidate receipts signed under a previous `kid`; old public keys are retained in the JWKS for verification.
- **Evidence:** `docs/technical-faq.md` §A3, `docs/SECURITY_ARCHITECTURE.md` §3 (Rotation row).

### CCC-05 — Configuration baseline / hardening
- **Status:** PARTIAL
- **Answer:** Firestore security rules enforce per-vault isolation. The wall (server-side composite recompute) recomputes every signal server-side; client-supplied scores are not trusted. Honeypot canary, composition-integrity, and environmental-gate layers form a defense-in-depth stack. There is no formal CIS-Benchmarks-style hardening checklist applied at infrastructure level beyond Google Cloud's defaults.
- **Evidence:** `docs/technical-faq.md` §A2, `proof/functions/index.js`.

### CCC-06 — Dependency review
- **Status:** IMPLEMENTED
- **Answer:** Core SDK has zero external runtime crypto dependencies; signing uses Node's built-in `crypto`. Vendored libraries: `@fingerprintjs/botd` (MIT, ~11 KB), `javascript-opentimestamps` (LGPL), `firebase-admin`, `jsonwebtoken`. Dev-only: `puppeteer`. Dependabot is enabled on the public repository per the SRE infrastructure batch (commit 7aaba2d). Full SBOM available on request.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8, `docs/technical-faq.md` §D3.

---

## 5. Data Security & Information Lifecycle Management (DSI)

### DSI-01 — Data classification
- **Status:** IMPLEMENTED (architectural)
- **Answer:** SWS does not collect, store, or transmit PII, PHI, payment data, or content. The data classification at the architectural level is "aggregate engagement metrics + cryptographic hashes" only. Stored fields are: duration (ms), interaction count (integer), quality tier (string), SHA-256 hash (hex), timestamp (ms), anonymous UID, and pseudonymous DID. There is no class of data at higher sensitivity to classify.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §1 (PHI table), `docs/SECURITY_ARCHITECTURE.md` §1 ("What NEVER enters the payload").

### DSI-02 — Data residency / region
- **Status:** IMPLEMENTED
- **Answer:** Firestore is configured US-region by default (multi-region available). EU-region or other-region deployment can be configured per pilot. No data is replicated outside the configured Firestore region.
- **Evidence:** `docs/technical-faq.md` §B5.

### DSI-03 — Data retention
- **Status:** IMPLEMENTED
- **Answer:** Per-data-type retention is documented: localStorage hashes retained until user clears or 10,000-cap auto-trim; Firestore hashes indefinite under user control; Firestore balance indefinite under user control; API session data 90 days auto-expire; webhook logs 30 days; API access logs 90 days. Firestore TTL policies enforce session-level retention. Pilots can configure 30-day TTL on raw session rows while keeping signed receipts indefinitely.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §7, `docs/technical-faq.md` §B5.

### DSI-04 — Data deletion / right to erasure
- **Status:** IMPLEMENTED
- **Answer:** `SWSPrivacy.deleteAllData()` performs a complete erasure across localStorage and Firestore. JSON export of all stored user data is available via `SWSPrivacy.exportAllData()`. This satisfies GDPR Articles 15 (access), 17 (erasure), and 20 (portability) at the technical layer. The integrator owns the surfacing of the delete/export flow to data subjects.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §4 (GDPR table), `docs/SECURITY_ARCHITECTURE.md` §7.

### DSI-05 — Data leakage / PII exposure
- **Status:** IMPLEMENTED
- **Answer:** No PII is collected at any layer. Even in the event of full database access, no personal information can be extracted because none was ever collected. The schema enforces this: there are no fields for names, emails, dates, phone numbers, government IDs, IP addresses, device fingerprints, location, photos, or biometrics. Round-7 closed a fingerprint-leak finding in the HTTP response and signed JWT path (commit bdfe797).
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §1, `docs/SECURITY_ARCHITECTURE.md` §5 (Privacy Breach threat).

### DSI-06 — Data integrity
- **Status:** IMPLEMENTED
- **Answer:** Receipt-hash chain (SHA-256 over canonical JSON, embedded inside the signed VC) plus the outer Ed25519 signature give two independent integrity checks. Any byte-level modification invalidates both. Optional RFC 3161 and OpenTimestamps Bitcoin anchors provide independent post-hoc timestamp integrity. Firestore deduplication prevents replay of an identical hash.
- **Evidence:** `docs/technical-faq.md` §E2, `docs/SECURITY_ARCHITECTURE.md` §5 (Data Tampering, Replay).

### DSI-07 — Data return on contract termination
- **Status:** IMPLEMENTED
- **Answer:** Customer data exports as JSON in a standard format. Receipts are customer-portable by construction — the JWT plus the JWKS file is sufficient to verify any receipt anywhere, forever, without SWS involvement. Sunset-scenario export is committed in the FAQ as an architectural property.
- **Evidence:** `docs/technical-faq.md` §H3.

---

## 6. Datacenter Security (DCS)

### DCS-01 — Physical datacenter security
- **Status:** IMPLEMENTED (inherited)
- **Answer:** All compute and storage runs on Google Cloud Platform datacenters. Physical security is inherited from Google Cloud's SOC 2 Type II, ISO 27001, and FedRAMP-Moderate-attested datacenter program. SWS does not own, operate, or maintain any physical datacenter or physical hardware. The founder's workstation is the only SWS-managed endpoint.
- **Evidence:** Google Cloud Compliance Reports Manager, `docs/SECURITY_ARCHITECTURE.md` §8.

### DCS-02 — Datacenter location and jurisdiction
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Firestore region is US-multi-region (`nam5`) by default. EU (`eur3`) or other-region configuration is available per pilot. Underlying datacenter locations are Google-published per region.
- **Evidence:** `docs/technical-faq.md` §B5.

### DCS-03 — Environmental controls
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Power, cooling, fire suppression, environmental monitoring, and physical-access controls are inherited from Google Cloud's datacenter operation. SWS-specific environmental controls do not apply (no SWS-owned datacenter).
- **Evidence:** Google Cloud Datacenter security overview.

### DCS-04 — Hardware decommissioning
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Inherited from Google Cloud's media-sanitization and hardware-disposition program (NIST SP 800-88-aligned). SWS owns no production hardware.
- **Evidence:** Google Cloud Compliance Reports Manager.

---

## 7. Encryption & Key Management (EKM)

### EKM-01 — Encryption in transit
- **Status:** IMPLEMENTED
- **Answer:** TLS 1.2+ for all communications between client and Firebase, between client and Cloud Functions, and between client and the JWKS endpoint. Certificates are Google-managed for `*.web.app` and `*.cloudfunctions.net` endpoints. No plaintext-HTTP path exists in the production data flow.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §2.

### EKM-02 — Encryption at rest (infrastructure)
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Firestore encrypts data at rest with AES-256 using Google-managed keys (default Cloud KMS configuration). Cloud Storage similarly. Google Secret Manager stores `SWS_DID_SALT`, `SWS_SIGNING_KEY`, and `SWS_SIGNING_KID` with envelope encryption under Google-managed keys. Customer-Managed Encryption Keys (CMEK) are available on the Firebase / Google Cloud side and could be configured per pilot.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §2, Google Cloud encryption-at-rest documentation.

### EKM-03 — Encryption at rest (client localStorage)
- **Status:** PARTIAL
- **Answer:** Client-side localStorage is unencrypted on-device, which is standard browser behavior. The data stored there is the same aggregate-metrics + hash payload — no PII, no content. Receipt payloads carry their own content-bound SHA-256 plus the outer Ed25519 signature, so tampering at the localStorage layer is detectable on next sync. Whole-disk encryption is the user's operating-system responsibility.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §2, §5 (localStorage Manipulation threat).

### EKM-04 — Hash algorithm
- **Status:** IMPLEMENTED
- **Answer:** SHA-256 via the browser's SubtleCrypto API (FIPS 140-2 validated in Chrome, Firefox, Safari, Edge). A pure-JavaScript SHA-256 fallback covers older or locked-down browsers; the Ed25519 polyfill covers WebCrypto-Ed25519-absent browsers (commit 30cacab). Hash output is the standard 64-character hex string. Collision resistance is the standard 2^128 operations.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §2, `docs/COMPLIANCE_MATRIX.md` §2 (SHA-256 Compliance).

### EKM-05 — Signing algorithm
- **Status:** IMPLEMENTED
- **Answer:** Ed25519 (RFC 8032 EdDSA, RFC 8037 JOSE-blessed) over the receipt's canonical JSON, serialized as a JWT. Chosen over ECDSA-P256 because Ed25519 is deterministic (no nonce-reuse CVE), has a 64-byte fixed signature, faster verification, no curve-parameter-choice. Post-quantum migration path is designed in via JWT `alg` header + JWKS multi-`kid`.
- **Evidence:** `docs/technical-faq.md` §A2, §E1.

### EKM-06 — Key generation, storage, rotation
- **Status:** IMPLEMENTED
- **Answer:** The signing key is a 32-byte Ed25519 seed stored in Google Secret Manager as `SWS_SIGNING_KEY`; current key ID in `SWS_SIGNING_KID`; DID-derivation salt in `SWS_DID_SALT`. Keys never leave the server; only the public key is published at `/.well-known/attention-pubkey.json`. Rotation via JWT `kid` plus multi-key JWKS — receipts under an old `kid` remain verifiable while the old public key remains in the JWKS.
- **Evidence:** `docs/technical-faq.md` §A3, `docs/SECURITY_ARCHITECTURE.md` §3.

### EKM-07 — Key compromise procedure
- **Status:** PARTIAL
- **Answer:** On suspected compromise: rotate `SWS_SIGNING_KEY` to a new seed and update `SWS_SIGNING_KID`; publish the new public key in the JWKS; mark the old `kid` as revoked in a published revocation list; notify customers holding receipts under the compromised `kid`. The mechanism is in place; a written runbook for the human steps is sketched in the SRE batch but is not yet a one-page playbook.
- **Evidence:** `docs/technical-faq.md` §A3, SRE runbooks in repository.

### EKM-08 — Customer-managed keys
- **Status:** NOT YET
- **Answer:** Customer-Managed Encryption Keys (CMEK) for Firestore are configurable per Firebase project but not yet deployed. Per-tenant SWS-side signing keys are architecturally feasible (JWKS supports multi-`kid`); no productized self-hosted signer ships today. Available as scoped pilot work.
- **Evidence:** `docs/technical-faq.md` §F3.

---

## 8. Governance & Risk Management (GRM)

### GRM-01 — Information security policy
- **Status:** NOT YET
- **Answer:** No formal written information-security policy document exists. The SECURITY_ARCHITECTURE.md and COMPLIANCE_MATRIX.md are the closest equivalent — they describe the threat model, controls, and per-clause posture. A formal ISMS-style policy is post-pilot work.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md`, `docs/COMPLIANCE_MATRIX.md`.

### GRM-02 — Risk assessment cadence
- **Status:** PARTIAL
- **Answer:** Seven hostile-review rounds have been conducted between 2026-04-21 and 2026-04-28, each producing a documented set of findings and tracked closing commits. Round-by-round summaries are in user memory and the round notes. There is no formal annual risk assessment yet; the hostile-review cadence is the substitute today.
- **Evidence:** Repo commit history `bba04db..bdfe797`, round-by-round notes.

### GRM-03 — Designated security officer
- **Status:** NOT YET
- **Answer:** No separate Chief Information Security Officer or named security lead. The director (Stephen Furpahs) is the security point of contact. This is single-founder operation; growth plan is deterministic post-first-revenue.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §8 (Contact), `docs/technical-faq.md` §H2.

### GRM-04 — Insurance (E&O / cyber liability)
- **Status:** NOT YET
- **Answer:** No errors-and-omissions or cyber-liability policy is currently in force. Liability is carried under SWS Strategic Media LLC. Insurance is negotiable as part of a pilot-structured MSA — the pilot can be priced to fund the policy.
- **Evidence:** `docs/technical-faq.md` §I.

### GRM-05 — Patent and IP posture
- **Status:** IMPLEMENTED
- **Answer:** USPTO provisional patent SWS-PROV-001 was filed 2026-03-17 covering the cryptographic-attention-receipt method. The product source is public on GitHub; the patent is the moat, not code obscurity. Code-public-plus-patent-filed is the deliberate posture.
- **Evidence:** `docs/technical-faq.md` §D2, `docs/COMPLIANCE_MATRIX.md` (header line "Patent Pending: SWS-PROV-001").

### GRM-06 — Subprocessor list
- **Status:** IMPLEMENTED
- **Answer:** Subprocessors: Google Cloud / Firebase (compute, storage, secrets, auth, hosting); FingerprintJS (BotD library — runs client-side, no SWS-side data flow to FingerprintJS servers in our default configuration); OpenTimestamps public calendar servers (one-way SHA-256 hash submission, no PII); optional RFC 3161 TSA (configurable per pilot — FreeTSA, DigiCert, Sectigo, GlobalSign, Entrust, or self-hosted). No other subprocessors today.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8, `docs/technical-faq.md` §D3, §E5.

### GRM-07 — Acceptable use of customer data
- **Status:** IMPLEMENTED
- **Answer:** Customer data is not used to train machine-learning models, not sold, not shared with advertising partners. The 20 behavioral signals are deterministic formulas from published papers (Fitts, Hick, Lacquaniti-Terzuolo-Viviani, Van Orden, Shannon); no classifier is trained on user data. CCPA "right to opt-out of sale" is satisfied by architecture — there is no sale.
- **Evidence:** `docs/technical-faq.md` §B6, `docs/COMPLIANCE_MATRIX.md` §5 (CCPA).

---

## 9. Human Resources Security (HRS)

### HRS-01 — Background checks
- **Status:** N/A (single founder)
- **Answer:** Single-founder operation. No employees, no contractors with production access. The founder is the only person with credentials to the production Firebase project. Pre-employment background checks become applicable when the first hire is made.
- **Evidence:** `docs/technical-faq.md` §H2.

### HRS-02 — Security awareness training
- **Status:** NOT YET
- **Answer:** No formal vendor security training program exists. The founder maintains a personal cadence of reviewing OWASP Top 10, the public CVE feed, and the seven-round hostile-review findings. Formal annual training and attestation will be instituted when the first employee is onboarded.
- **Evidence:** N/A.

### HRS-03 — Acceptable use policy
- **Status:** NOT YET
- **Answer:** No formal AUP for SWS personnel exists today (single-founder). Will be drafted at first-hire.
- **Evidence:** N/A.

### HRS-04 — Termination procedure
- **Status:** N/A (single founder)
- **Answer:** No employees, so no termination-of-access procedure to document. When applicable, the procedure will mirror standard practice: same-day revocation of Firebase IAM, GitHub access, Secret Manager principal, and Workspace credentials.
- **Evidence:** N/A.

### HRS-05 — Confidentiality / NDA
- **Status:** PARTIAL
- **Answer:** No standing NDA template is pre-drafted. NDAs will be signed against buyer paper at pilot-engagement start. Customer data is protected by the architecture — there is no PII to mishandle — and by the absence of any third-party access to production credentials.
- **Evidence:** N/A.

---

## 10. Identity & Access Management (IAM)

### IAM-01 — End-user authentication
- **Status:** IMPLEMENTED
- **Answer:** Firebase Authentication: Anonymous Auth for visitor sessions (UID server-generated, persisted across reloads, new UID per device/browser); email/password or provider-based (Google, etc.) for registered users; Firebase ID token (JWT) auto-refreshed. Anonymous accounts can be linked to provider accounts at user election.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §3.

### IAM-02 — B2B API authentication
- **Status:** IMPLEMENTED
- **Answer:** API key (256-bit random) plus client_id, transmitted as `X-SWS-API-Key` header over HTTPS only. Each key scoped to a single client_id. Rotation supported without service interruption. Constant-time comparator added in 2026-04-21 hardening.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §3, `docs/technical-faq.md` §D4.

### IAM-03 — MFA for admin access
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Founder access to Firebase, Google Cloud Console, Secret Manager, and GitHub is gated by Google Workspace MFA (TOTP + hardware key). MFA is enforced at the IdP layer. No MFA-bypass paths exist for production access.
- **Evidence:** Google Workspace admin configuration; available on request.

### IAM-04 — Authorization model
- **Status:** IMPLEMENTED
- **Answer:** Firestore security rules enforce per-vault isolation: each authenticated user can read/write only the document path matching their own UID. No cross-user data access is possible from client code. Admin SDK access is server-side only and never exposed to clients. API authorization is per-client_id-scoped: a key cannot read sessions issued to another client_id.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §4, `firestore.rules` in repository.

### IAM-05 — Privileged access management
- **Status:** PARTIAL
- **Answer:** Production access is held by the single founder. Google Cloud IAM applies least-privilege roles per Cloud Function (e.g., `signReceipt` has access only to the signing-key secret). There is no separate break-glass account, no privileged-session-recording, no JIT elevation. These become applicable post-first-hire.
- **Evidence:** `firebase.json`, IAM bindings on the production project.

### IAM-06 — Access review cadence
- **Status:** PARTIAL
- **Answer:** No quarterly access review is scheduled today (single-principal). Each addition of a new IAM principal would be reviewed at addition. Post-pilot, a formal quarterly access review will be instituted.
- **Evidence:** N/A.

### IAM-07 — Webhook authentication
- **Status:** IMPLEMENTED
- **Answer:** Webhooks signed with HMAC-SHA256 against a shared secret. Recipients verify `HMAC-SHA256(secret, raw_body)` against the `X-SWS-Signature` header. Replay protection via timestamp validation.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §3.

---

## 11. Infrastructure & Virtualization Security (IVS)

### IVS-01 — Multi-tenant isolation
- **Status:** PARTIAL
- **Answer:** Logical multi-tenancy is enforced by Firestore security rules (per-UID vault scoping) and per-client_id API-key scoping. Physical multi-tenancy hardening — separate Firebase projects per customer, separate Cloud Function instances, separate Secret Manager namespaces — has not been implemented because no paying customer has been onboarded yet. Single-tenant Firebase project today; per-tenant project isolation is available as scoped pilot work.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §4, `docs/technical-faq.md` §F3.

### IVS-02 — Network segmentation
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Cloud Functions run inside Google Cloud's serverless network with IAM-gated egress. The application has no VPC, no private subnets, no jump hosts of its own — there are no SWS-managed VMs. Firebase egress is controlled by Google Cloud's network security defaults.
- **Evidence:** Firebase / Google Cloud network security documentation.

### IVS-03 — DDoS protection
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Inherited from Google Cloud's edge protection (Cloud Armor / Cloud Front). Cloud Functions and Firebase Hosting sit behind Google's global edge with default DDoS mitigation. Application-layer rate limiting (added 2026-04-21) provides a second layer.
- **Evidence:** Google Cloud Armor documentation, `docs/technical-faq.md` §D4.

### IVS-04 — Vulnerability scanning of infrastructure
- **Status:** PARTIAL
- **Answer:** Infrastructure scanning inherited from Google Cloud's continuous-scanning program. SWS-side: Dependabot enabled on the public repo (commit 7aaba2d). No paid SAST/DAST today; Dependabot plus the test suite plus hostile-review rounds substitute.
- **Evidence:** `docs/technical-faq.md` §D3, `.github/dependabot.yml`.

### IVS-05 — Container / serverless runtime hardening
- **Status:** IMPLEMENTED (inherited)
- **Answer:** Cloud Functions run in Google's gVisor-isolated sandboxes per invocation. SWS does not manage container images; runtime patching is handled by Google. No long-lived process exposure on the SWS side.
- **Evidence:** Google Cloud Functions runtime documentation.

---

## 12. Interoperability & Portability (IPY)

### IPY-01 — Standards compliance
- **Status:** IMPLEMENTED
- **Answer:** Receipts conform to: W3C Verifiable Credentials Data Model 2.0; RFC 8032 (EdDSA); RFC 8037 (JOSE EdDSA); RFC 7519 (JWT); RFC 3161 (TSA timestamps, optional); xAPI 1.0.3; OpenBadges 3.0 AchievementCredential. Hash algorithm conforms to FIPS 180-4 (SHA-256).
- **Evidence:** `docs/technical-faq.md` §A1, §F1.

### IPY-02 — Customer data export format
- **Status:** IMPLEMENTED
- **Answer:** All customer-stored data exports as JSON in a documented, machine-readable format. Receipts export as JWT strings. There is no proprietary binary format anywhere in the data path.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §4 Art. 20 row, `docs/technical-faq.md` §H3.

### IPY-03 — API standards
- **Status:** IMPLEMENTED
- **Answer:** REST over HTTPS with JSON request/response bodies. Webhook payloads are JSON. JWT signing is RFC 7519. JWKS publication is RFC 7517 at `/.well-known/attention-pubkey.json`. No proprietary RPC framework.
- **Evidence:** `docs/API_SPECIFICATION.md`, `docs/technical-faq.md` §A4.

### IPY-04 — LMS / learning-system interoperability
- **Status:** IMPLEMENTED
- **Answer:** Receipts serialize as xAPI 1.0.3 statements (Moodle, Canvas, Articulate 360, Cornerstone, Degreed, EthosCE, D2L Brightspace, SAP Learning Hub) and as OpenBadges 3.0 AchievementCredentials (Credly, Accredible, Sertifier). Single script-tag SDK plus one POST endpoint to fetch the signed receipt.
- **Evidence:** `docs/technical-faq.md` §F1, §F2.

### IPY-05 — Vendor lock-in
- **Status:** IMPLEMENTED (low)
- **Answer:** Receipts verify forever against the public JWKS without any SWS server involvement. JWKS is a static file mirrorable to any web host or S3 bucket. Source code is public on GitHub and forkable. Customer data exports as standard JSON. The architectural intent is "tamper-evident, not trust-us" — the customer can survive SWS sunset.
- **Evidence:** `docs/technical-faq.md` §H3, §A4.

---

## 13. Mobile Security (MOS)

### MOS-01 — Mobile-app distribution
- **Status:** N/A
- **Answer:** SWS does not currently ship a native mobile application. The product is delivered as a JavaScript SDK that runs inside the customer's web application or webview. Mobile-specific app-store distribution does not apply.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8 (Dependencies — browser-native APIs only).

### MOS-02 — Mobile-browser support
- **Status:** IMPLEMENTED
- **Answer:** SDK runs in modern mobile browsers (iOS Safari, Chrome on Android). Touch-Events-API, Page-Visibility-API, and Wake-Lock-API are used where present. Behavioral-signal weighting reweights for mobile contexts where four mouse-only signals correctly read 0; the composite score does not penalize mobile sessions for the absent mouse signals (commit pending: per April-26 real-test findings, mobile reweighting was identified as a gap and has been queued).
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8, user memory project_apr26_real_test_findings.md.

### MOS-03 — Mobile data storage
- **Status:** IMPLEMENTED
- **Answer:** Mobile-browser localStorage is the cache; no native-app sandbox; no MDM-managed device storage. Same data-class as desktop: aggregate metrics + hashes, no PII.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §1, §2.

### MOS-04 — Mobile permissions requested
- **Status:** IMPLEMENTED
- **Answer:** No camera, microphone, contacts, calendar, SMS, or location permissions are requested. Optional GPS is gated behind explicit per-feature consent and is not part of the core attention measurement. Wake-Lock is requested only for ambient-mode operation. Touch-Events are passive listeners requiring no permission grant.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8, `docs/technical-faq.md` §B3.

---

## 14. Security Incident Management, E-Discovery (SEF)

### SEF-01 — Incident response plan
- **Status:** PARTIAL
- **Answer:** No single-document formal Incident Response runbook covers the full lifecycle (preparation, identification, containment, eradication, recovery, lessons-learned). Five SRE runbooks cover specific scenarios (commit 7aaba2d): they are scenario-specific, not a full-IR document. A formal IR runbook is queued post-pilot. Pilot-stage IR posture is "founder is on-call 24/7" — disclosed honestly.
- **Evidence:** SRE runbooks in repository, `docs/technical-faq.md` §D5.

### SEF-02 — Breach notification SLA
- **Status:** PARTIAL
- **Answer:** No PII is collected; under most regimes there is no notifiable PII breach to report. Operational-incident notification SLA to customers will be negotiated per pilot — typically 72 hours from confirmed incident, aligned with GDPR Art. 33. Architectural advantage: there is no PII corpus to breach.
- **Evidence:** `docs/COMPLIANCE_MATRIX.md` §4 Art. 33 row, `docs/SECURITY_ARCHITECTURE.md` §5 (Privacy Breach threat).

### SEF-03 — Anomaly detection and monitoring
- **Status:** IMPLEMENTED
- **Answer:** Firebase Analytics monitors hash-generation rates per UID; Firestore usage monitoring flags unusual read/write patterns; API rate-limit alerting fires on threshold breach. Sudden hash-rate spike from a single UID triggers rate-limit tightening; persistent timing-CV below 0.1 escalates bot classification; hash-without-interaction events are flagged for review.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §6.

### SEF-04 — Incident response process
- **Status:** PARTIAL
- **Answer:** Documented steps: anomaly logged; affected sessions flagged; if automated attack — rate limit tightened, hashes quarantined; client notified on data-quality impact; post-incident review and threshold adjustment. Process is in place; not yet a NIST 800-61-format one-page runbook.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §6.

### SEF-05 — E-Discovery / legal hold
- **Status:** PARTIAL
- **Answer:** Receipts are immutable post-signing and discoverable via Firestore queries by session_id, client_id, or DID. Receipts contain no PII, only pseudonymous DIDs. Formal legal-hold workflow (suspending TTL deletion on a flagged session set) is not pre-built; would be implemented per legal request.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §7, `docs/technical-faq.md` §C2.

### SEF-06 — Forensic logging
- **Status:** PARTIAL
- **Answer:** API access logs retained 90 days; webhook logs 30 days; Firestore-side audit logs inherited from Google Cloud. Application-level structured logs are written from Cloud Functions to Cloud Logging. No SIEM forwarding is configured today; this is post-pilot work.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §7.

---

## 15. Supply Chain Management, Transparency, and Accountability (STA)

### STA-01 — Subprocessor disclosure
- **Status:** IMPLEMENTED
- **Answer:** See GRM-06. Subprocessor list: Google Cloud / Firebase, FingerprintJS BotD (client-side library only), OpenTimestamps public calendar servers (one-way SHA-256 submission), optional configurable TSA. The list is short by design.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §8, `docs/technical-faq.md` §D3.

### STA-02 — SBOM availability
- **Status:** IMPLEMENTED
- **Answer:** Full SBOM is available on request. Core SDK has zero external runtime crypto dependencies; signing uses Node's built-in `crypto` (OpenSSL-backed). Vendored libraries are enumerated and license-tagged in `docs/technical-faq.md` §D3.
- **Evidence:** `docs/technical-faq.md` §D3.

### STA-03 — Subprocessor change notification
- **Status:** PARTIAL
- **Answer:** Subprocessor changes will be notified per the DPA at signing — typically 30-day advance written notice with right-to-object. The current subprocessor set is small and stable; a change is not anticipated within pilot horizons.
- **Evidence:** Pending DPA template; will be negotiated against buyer paper.

### STA-04 — Open-source license review
- **Status:** IMPLEMENTED
- **Answer:** Vendored library licenses: `@fingerprintjs/botd` (MIT); `javascript-opentimestamps` (LGPL); `firebase-admin` (Apache 2.0); `jsonwebtoken` (MIT); `puppeteer` (Apache 2.0, dev/test-only). LGPL inclusion of OpenTimestamps is dynamically linked and does not propagate copyleft to the proprietary SDK. License-compatibility review is repeated at each dependency addition.
- **Evidence:** `docs/technical-faq.md` §D3, `package.json` in repository.

### STA-05 — Patent and IP indemnity
- **Status:** PARTIAL
- **Answer:** USPTO provisional SWS-PROV-001 was filed 2026-03-17. Patent indemnity for customers is not pre-templated; will be addressed in the MSA at contract.
- **Evidence:** `docs/technical-faq.md` §D2.

### STA-06 — Subcontractor security
- **Status:** N/A (no subcontractors)
- **Answer:** No human subcontractors with production access. The "team" is the founder plus AI-augmented tooling that produces code reviewed and approved per-commit by the founder; no remote contractor has Firebase, Secret Manager, or GitHub access.
- **Evidence:** `docs/technical-faq.md` §H2.

---

## 16. Threat and Vulnerability Management (TVM)

### TVM-01 — Vulnerability management process
- **Status:** PARTIAL
- **Answer:** Inbound vulnerability reports route to the founder. Dependabot alerts on dependency CVEs in the public repo. Internal hostile-review rounds (seven completed) are the proactive substitute for an annual pen-test. Remediation SLA: a critical-severity finding is patched same-day in the documented round-1 through round-7 cadence; a high is patched within one week.
- **Evidence:** Repo commit history, `.github/dependabot.yml`, `docs/technical-faq.md` §D4.

### TVM-02 — Patching cadence
- **Status:** PARTIAL
- **Answer:** Application code: patch-on-demand against Dependabot alerts and hostile-review findings. Infrastructure: inherited Cloud Functions runtime patching from Google Cloud. No fixed monthly patch window is published; the cadence is event-driven.
- **Evidence:** Repo commit history, Google Cloud Functions runtime documentation.

### TVM-03 — Anti-malware
- **Status:** N/A (architectural)
- **Answer:** No customer-uploaded files, no executable content received from customers, no email gateway, no employee endpoints with customer data. Anti-malware is therefore inherited from Google Cloud's serverless runtime and from the founder's workstation OS (macOS XProtect / built-in defenses). Application-layer payload validation rejects malformed or oversized inputs.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §1 (data flow).

### TVM-04 — Bot and automation defense
- **Status:** IMPLEMENTED
- **Answer:** Six-signal behavioral composite (timing CV, Fitts, Hick, scroll-saccade, micro-pause, touch-area variance) plus FingerprintJS BotD gate plus composition-integrity plus honeypot canary plus server-side wall (composite recompute on Cloud Functions). Round-2 adversarial agent estimated post-wall bypass cost at $5–20K/mo plus 200–400 engineering hours, a 100–400× cost increase over pre-wall. Bots are classified to background tier, making automation economically unattractive.
- **Evidence:** `docs/SECURITY_ARCHITECTURE.md` §5, `docs/technical-faq.md` §A2.

### TVM-05 — Bug bounty / responsible disclosure
- **Status:** NOT YET
- **Answer:** No public bug bounty program is currently published. Vulnerability reports may be sent to the founder directly. A formal responsible-disclosure policy and bounty program is post-first-pilot work.
- **Evidence:** N/A.

### TVM-06 — Internal security testing
- **Status:** IMPLEMENTED
- **Answer:** 270+ automated tests across 45 suites including 63+ explicit security-regression tests mapped one-to-one to the 2026-04-21 audit findings. Tests run on every commit locally. Seven hostile-review rounds with documented findings and tracked closing commits.
- **Evidence:** `npm test` output, `docs/technical-faq.md` §D4.

### TVM-07 — Known CVEs
- **Status:** IMPLEMENTED
- **Answer:** No externally-reported CVEs to date. No third-party-audit findings to disclose. Internal audit findings are publicly traceable in the Git history (commit range `bba04db..bdfe797` covers the seven hostile-review rounds plus the SRE batch).
- **Evidence:** Public repo commit history, `docs/technical-faq.md` §D4.

---

## Closing notes

Every formal questionnaire response should be cross-checked against the source documents before submission. Where a buyer requires a control SWS does not yet have (SOC 2 Type II, paid pen-test letter, dedicated CISO, 24/7 SOC, NIST-800-61 IR runbook), the answer is `NOT YET` with a planned-timing window. Pilots run behind the customer's existing IT-security wrapper, and the pilot audit artifact is itself an input to subsequent formal-attestation work.
