# SWS Attention Protocol — Compliance Matrix
## Enterprise Regulatory Readiness
### SWS Strategic Media LLC | Patent Pending: SWS-PROV-001

---

## EXECUTIVE SUMMARY

The SWS Proof of Attention Protocol is **privacy-safe by architecture**. The system measures engagement quality — how long, how interactive, how genuine — without recording any content, URLs, messages, or personal information. This architecture provides built-in compliance with major regulatory frameworks.

---

## 1. HIPAA COMPLIANCE

### Protected Health Information (PHI) Assessment

| PHI Category | Collected? | Details |
|-------------|-----------|---------|
| Patient names | NO | User identified by anonymous UID only |
| Dates (birth, treatment, death) | NO | Only engagement timestamps |
| Phone/fax numbers | NO | Not collected |
| Email addresses | NO | Not collected |
| Social Security numbers | NO | Not collected |
| Medical record numbers | NO | Not collected |
| Health plan beneficiary numbers | NO | Not collected |
| Account numbers | NO | Not collected |
| Certificate/license numbers | NO | Not collected |
| Device identifiers | NO | Session ID generated fresh each session |
| URLs | NO | Never captured |
| IP addresses | NO | Not captured by the protocol |
| Biometric identifiers (BIPA §10 / TX SB 800 / WA HB 1493 enumerated) | NO | Not collected. The statutes enumerate retina, iris, fingerprint, voiceprint, and scan of hand/face geometry — none of which the SDK touches. SWS measures aggregate keystroke-cadence and mouse-trajectory statistics (digraph timing, Fitts/Hick compliance, submovement count, etc.) and stores them as bucketed numbers, never as raw events. See `docs/legal/bipa-posture.md` for the full theory. |
| Photos | NO | Not collected |
| Any other unique identifier | NO | Anonymous UID only |

### Conclusion
**No Business Associate Agreement (BAA) is required** because the protocol never accesses, stores, transmits, or processes any Protected Health Information. The protocol operates exclusively on aggregate behavioral metrics (durations, counts, quality scores) and cryptographic hashes.

However, SWS Strategic Media LLC **will execute a BAA upon request** for clients who require one for their internal compliance processes.

### What We DO Store
- Aggregate time durations (milliseconds)
- Interaction counts (integer count of taps, clicks, keystrokes — never content)
- Quality tier classification (deep/active/passive/background)
- SHA-256 attention hashes (irreversible, cannot reveal source data)
- Focus Score (0-100 numeric rating)

---

## 2. SCIF / MILITARY ELIGIBILITY

### Zero-Content Architecture

The SWS Attention Protocol was designed from the ground up with classified environments in mind.

| Data Category | Present in Payload? | Present in Storage? |
|--------------|--------------------|--------------------|
| Page URLs | NO | NO |
| Page titles | NO | NO |
| App names | NO | NO |
| Message content | NO | NO |
| Keystroke content | NO | Count only |
| Screen content | NO | NO |
| File names | NO | NO |
| User location | NO | Opt-in GPS only for movement features |
| Network identifiers | NO | NO |
| Device fingerprints | NO | NO |

### Air-Gapped Operation

The protocol can run in **fully air-gapped mode**:
- All hashes stored in localStorage (no network required)
- Firebase/cloud sync is optional and can be disabled
- Behavioral analysis runs entirely client-side
- No external API calls required for core functionality

```javascript
SWSAttention.init({
  gameId: 'classified_training',
  enableCloudSync: false  // Air-gapped mode
});
```

### SHA-256 Compliance
- Uses browser's SubtleCrypto API (FIPS 140-2 validated in modern browsers)
- Pure JavaScript fallback for restricted environments
- Hash output is standard 64-character hexadecimal

### Conclusion
**The SWS Attention Protocol is eligible for deployment in classified environments (SCIF, SCI, SAP)** because no content, URLs, or identifiable information ever enters the system. The only data processed is aggregate behavioral metrics that carry no classification risk.

---

## 3. SOC 2 READINESS

### Trust Service Criteria Mapping

#### Security (Common Criteria)
| Control | Implementation |
|---------|---------------|
| Encryption in transit | TLS 1.2+ (HTTPS) for all cloud sync |
| Encryption at rest | Google Cloud default encryption (Firestore) |
| Access control | Firestore security rules: users access only their own vault |
| Authentication | Firebase Auth (anonymous or provider-based) |
| Input validation | Payload schema validation, type checking |
| Rate limiting | Client-side burst protection, daily caps per event type |

#### Availability
| Control | Implementation |
|---------|---------------|
| Offline capability | Full functionality with localStorage, no cloud required |
| Sync resilience | Exponential backoff retry (2s, 4s, 8s, 16s, 32s) |
| Failover | JS SHA-256 fallback if SubtleCrypto unavailable |
| Storage overflow | Automatic trimming at 10,000 hashes |

#### Processing Integrity
| Control | Implementation |
|---------|---------------|
| Deterministic hashing | SHA-256 with alphabetically sorted JSON keys |
| Receipt integrity | Receipt hash verifiable by recomputation |
| Nonce uniqueness | Timestamp + random value prevents collisions |
| Payload validation | Type checking, range validation on all fields |

#### Confidentiality
| Control | Implementation |
|---------|---------------|
| No PII in payloads | Architecture enforced — no fields for PII exist |
| No content capture | No URL, message, or screen content fields |
| Trade secret protection | Calibration values loaded at runtime, not in source |
| Hash irreversibility | SHA-256 is one-way — payload cannot be reconstructed |

#### Privacy
| Control | Implementation |
|---------|---------------|
| Opt-in consent | All tracking requires explicit consent |
| Data export | Full JSON export of all user data |
| Data deletion | Complete erasure from localStorage and Firestore |
| Consent granularity | Per-feature consent (tracking, behavioral, cloud, fitness) |
| Consent revocation | Single-call revoke all function |

---

## 4. GDPR COMPLIANCE

### Article-by-Article Assessment

| Article | Requirement | Compliance |
|---------|------------|-----------|
| **Art 6** | Lawful basis for processing | Consent (opt-in) — no processing without explicit consent |
| **Art 7** | Conditions for consent | Clear consent UI with per-feature toggles, easy withdrawal |
| **Art 12** | Transparent information | Privacy notice describes exactly what is/isn't collected |
| **Art 13** | Information at collection | Consent banner explains: "We track HOW LONG you engage, not WHAT you do" |
| **Art 14** | Information not from data subject | N/A — all data comes from the data subject directly |
| **Art 15** | Right of access | `SWSPrivacy.exportAllData()` returns all stored data |
| **Art 16** | Right to rectification | Not applicable — we store aggregate metrics, not personal statements |
| **Art 17** | Right to erasure | `SWSPrivacy.deleteAllData()` — complete local + cloud deletion |
| **Art 18** | Right to restriction | Consent can be revoked per-feature |
| **Art 20** | Right to data portability | JSON export in machine-readable format |
| **Art 25** | Data protection by design | Privacy-safe architecture — no PII fields exist in the data model |
| **Art 32** | Security of processing | SHA-256 hashing, TLS transit, Firestore encryption at rest |
| **Art 33** | Breach notification | No PII to breach — but monitoring in place for anomalies |
| **Art 35** | Data protection impact assessment | Low risk — aggregate metrics only, no profiling |

### Data Processing Agreement
SWS Strategic Media LLC will provide a Data Processing Agreement (DPA) upon request for EU/EEA clients.

---

## 5. CCPA COMPLIANCE (California Consumer Privacy Act)

| Right | Implementation |
|-------|---------------|
| Right to know | Data export shows all collected information |
| Right to delete | Complete data deletion function |
| Right to opt-out of sale | We NEVER sell personal information — by architecture |
| Right to non-discrimination | No service degradation for privacy choices |
| Notice at collection | Consent banner describes data categories |

**CCPA Category Disclosure:**
- Categories collected: Internet or other electronic network activity information (aggregate engagement metrics only)
- Categories NOT collected: Identifiers, commercial information, biometric, geolocation, sensory data, professional information, education information, inferences

---

## 6. COPPA COMPLIANCE (Children's Online Privacy Protection Act)

### Why COPPA Compliance Matters
Any application used by children under 13 must comply with COPPA. The SWS Attention Protocol is **COPPA-compliant by architecture** because:

| COPPA Requirement | Our Compliance |
|------------------|---------------|
| No personal information from children | No personal information from ANYONE — the payload has no PII fields |
| Verifiable parental consent | Not required — we collect no personal information |
| No persistent identifiers for behavioral advertising | Anonymous session IDs regenerated each session |
| No behavioral profiling | We measure engagement quality, not individual behavior patterns |

### COPPA Verification
The SDK includes a built-in COPPA verification function:
```javascript
SWSPrivacy.verifyCOPPA(hashPayload);
// Returns: { compliant: true, violations: [] }
```

---

## 7. FERPA COMPLIANCE (Family Educational Rights and Privacy Act)

For education sector deployments:

| FERPA Requirement | Our Compliance |
|------------------|---------------|
| No disclosure of education records | We never access education records |
| No student PII | No PII of any kind |
| Directory information exclusion | Not applicable — no student data |
| Annual notification | Not required — no education records accessed |

**What we CAN provide for education:** Per-student engagement quality scores (identified by anonymous session ID, not student identity) that indicate whether a student genuinely engaged with course material.

---

## 8. CONTACT FOR COMPLIANCE INQUIRIES

**SWS Strategic Media LLC**
Stephen Furpahs, Director
Patent Pending: SWS-PROV-001

For compliance documentation requests, DPA/BAA execution, or security questionnaire completion, contact the Director directly.

---

*Compliance Matrix v1.0 — SWS Proof of Attention Protocol — March 2026*
