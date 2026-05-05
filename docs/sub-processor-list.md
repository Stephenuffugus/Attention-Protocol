# Sub-processor List
## SWS Proof-of-Attention Protocol

**Last updated:** 2026-05-05 · **Authoritative:** this list and `docs/privacy-DPIA.md` §2.6 must agree.
**Notification policy:** SWS will notify customers in writing at least 30 days before adding any new sub-processor with access to customer-side data. The notification will identify the sub-processor, describe the processing activity, and identify any onward transfer.

---

## Required sub-processors

These are involved in every receipt SWS issues.

### Google Cloud / Firebase

- **Role:** Hosting (Firebase Hosting), serverless runtime (Cloud Functions), database (Firestore), secret storage (Secret Manager), anonymous authentication (Firebase Auth)
- **Data accessed:** session receipt rows (no PII per `docs/privacy-DPIA.md`), signing keys (encrypted at rest in Secret Manager), TLS-stack-observed IP (Cloud Functions request logs, ~30-day Google default retention)
- **Hosting region:** US multi-region by default; `eur3` (Belgium / Netherlands / Finland) available on customer request
- **Independent attestation:** SOC 2 Type II, SOC 3, ISO 27001, ISO 27017, ISO 27018, FedRAMP High, HIPAA-eligible (BAA available directly from Google)
- **DPA:** Google Cloud Data Processing and Security Terms (https://cloud.google.com/terms/data-processing-addendum) — incorporates Standard Contractual Clauses Module 2
- **Onward transfer:** None for the SWS deployment. Google may use sub-processors per its DPA; customer references that DPA directly for downstream chain.

---

## Optional sub-processors (customer opt-in only)

These engage only if the customer chooses to enable Bitcoin or RFC 3161 anchoring on their receipts.

### OpenTimestamps calendar servers

- **Role:** Bitcoin-anchor timestamp aggregation
- **Data transmitted:** SHA-256 hash of the receipt only — no PII, no behavioral data, no content
- **Operator:** Public calendar servers (e.g., `alice.btc.calendar.opentimestamps.org`, `bob.btc.calendar.opentimestamps.org`)
- **Independent attestation:** Open-source software, public-blockchain-anchored. Operating servers do not see receipt contents — only an opaque hash.
- **Privacy implication:** The hash is a one-way derivation; no inversion possible.
- **DPA:** Public-good service; no formal DPA available. Customer accepts via opt-in flag.

### RFC 3161 Time-Stamp Authority (customer's choice)

- **Role:** Commercial timestamp authority providing RFC 3161 tokens
- **Data transmitted:** SHA-256 hash of the receipt only — same scope as OpenTimestamps
- **Typical operators:** DigiCert, Sectigo, GlobalSign, FreeTSA (customer's choice — SWS supports all four endpoints)
- **Independent attestation:** RFC 3161 (PKIX-TSP), eIDAS qualified-trust-service eligibility (operator-dependent)
- **DPA:** Customer arranges directly with their chosen TSA operator.

---

## Dependencies that are NOT sub-processors

These are explicitly listed because they often appear in vendor-questionnaire sub-processor sections elsewhere — they are not sub-processors here.

| Library / Service | Why not a sub-processor |
|---|---|
| **`@fingerprintjs/botd`** (environmental gate) | Open-source library bundled with the SDK. Runs entirely in the user's browser. **Nothing transmitted to FingerprintJS.** Only its boolean automation-detection verdict is recorded in the receipt. |
| **`javascript-opentimestamps`** | Client-side library used to construct OpenTimestamps requests. The actual calendar communication is the OpenTimestamps sub-processor above (and only if customer opts in). |
| **`puppeteer`, `puppeteer-extra-stealth`** | Development and test-only. Never shipped to production. Not invoked at runtime. |
| **Node `crypto` module** | Built-in Node standard library; OpenSSL-backed. Local-only computation; no remote service. |
| **`firebase-admin`** | Firebase SDK; the underlying processor is Google Cloud (listed above). |
| **No analytics SDK** | The protocol path contains no Google Analytics, Segment, Mixpanel, Heap, Amplitude, FullStory, LogRocket, Hotjar, or equivalent. The optional `ga4-bridge.js` exists for customers who run their *own* GA4; SWS does not transmit to Google Analytics on the customer's behalf. |
| **No CDN tracking** | Firebase Hosting is the CDN. No third-party CDN beacons. |

---

## Signed-DPA list (operational)

The following data-processing agreements are or will be executed at contract signing.

| Counterparty | DPA status | Notes |
|---|---|---|
| Google Cloud / Firebase (SWS as customer of Google) | **Executed** as part of the Firebase project agreement | SCC Module 2 incorporated |
| **SWS → Customer DPA** | **Negotiated per pilot** | SWS signs customer paper. No SWS-template DPA exists yet (post-entity-formalization work). |
| **HIPAA BAA between SWS and Customer** | **Not yet executable by SWS directly** | Available indirectly via Google Cloud BAA where customer is also a Google Cloud customer. SWS-direct BAA after entity formalization (Delaware C-corp pending). |

---

## Change history

| Date | Change |
|---|---|
| 2026-05-05 | Initial publication. Aligned with `docs/privacy-DPIA.md` §2.6. |

---

**Cross-references:** `docs/privacy-DPIA.md` · `docs/architecture-1pager.md §76-83` · `docs/SECURITY_ARCHITECTURE.md` · `docs/security-questionnaire-prefill.md` AAC-02 (inherited attestation)
