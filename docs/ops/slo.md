# SWS Attention Protocol — Service Level Objectives

**Status:** Working draft — published 2026-04-28 (round-7 R2-NEW-18 closure).
Pending counsel + customer review before any contractual SLA.
**Scope:** sws-attention-proofs.web.app + the Cloud Functions that back it.
**Out of scope:** stevieweedseed.com (separately operated on Hostinger).

---

## Headline numbers

| Metric | Target | Measurement window | Current state |
|---|---|---|---|
| Verifier path availability | 99.0% | rolling 30 days | unmeasured (no synthetic monitor yet) |
| Receipt-issuance availability | 99.0% | rolling 30 days | unmeasured |
| Receipt-issuance p95 latency | 500 ms | rolling 7 days | observed 94-287 ms (CI baseline) |
| RTO (recovery time after outage) | 4 hours | per incident | unproven (no documented runbook drill yet) |
| RPO (data loss tolerance) | 24 hours | per incident | bounded by Firebase Hosting + Firestore daily backup |

The 99.0% target translates to ~7h 18min of allowed downtime per
30-day window. This is a **pragmatic floor** — it survives a single
multi-hour Firebase regional outage per month without breaching.
**99.9% is not a credible target today** without 5-6 weeks of
hardening (synthetic monitor, multi-region failover, on-call
rotation). The round-1 SRE review estimated this; round-7 has not
changed the estimate.

---

## What's IN scope

The SLO covers:

1. **`https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json`**
   — JWKS endpoint. Serving this is the cryptographic dependency for
   every verifier. Cache-Control: no-store (R3-NEW-fix) means there's
   no edge cache to fall back on.

2. **`https://sws-attention-proofs.web.app/verify.html`** — the
   browser verifier. Pure static HTML + WebCrypto API; depends only on
   Firebase Hosting CDN. Highest-availability surface in the system
   because it has no backend.

3. **`https://sws-attention-proofs.web.app/cme-demo.html`** — the
   issuance flow. Depends on Firebase Hosting + Firebase Auth (for
   anonymous sign-in) + Firestore (for the demos collection write) +
   Cloud Functions onSessionWritten trigger (for signing).

4. **`signReceipt` Cloud Function** — HTTP signing endpoint. Fires
   the wall (R2-NEW-2 server-side recompute + R2-NEW-2b trace-novelty)
   and returns a signed JWT.

5. **`onSessionWritten` Cloud Function** — Firestore trigger that
   auto-signs `demos/*` writes. Fires the same wall.

## What's OUT of scope

- **OpenTimestamps Bitcoin anchoring** — depends on the global OTS
  calendar network. The SDK degrades gracefully (`status: 'pending'`
  or `status: 'failed'`) when the calendar is unavailable. We do not
  promise OTS availability.

- **RFC 3161 TSA timestamping** — same. Multiple TSAs (FreeTSA,
  DigiCert, Sectigo) provide redundancy; we do not promise individual
  TSA availability.

- **stevieweedseed.com** — separately operated.

- **Third-party browsers older than Chrome 113 / Safari 17 / Firefox
  130** that lack WebCrypto Ed25519 support. Verifier degrades
  gracefully (T2-7 polyfill queued).

---

## Error budget

The 99.0% target gives a 1.0% error budget over 30 days = ~7h 18min
of allowed downtime.

**Burn-rate alerts** (when wired into Cloud Monitoring per
`docs/ops/observability.md`):
- 5% budget burn in 1 hour → page on-call
- 10% budget burn in 6 hours → escalate
- 50% budget burn in 30 days → freeze non-emergency releases

Today there is no burn-rate measurement; the SLO is aspirational until
the observability infrastructure ships.

---

## Incident response

See `docs/ops/runbooks/` for per-failure-mode runbooks. The
high-level procedure:

1. **Confirm scope** — is the issue affecting the verifier path
   (highest-priority), the issuance path, or just one of the
   peripheral pages (gallery, receipt-explorer, etc.)?
2. **Triage to the appropriate runbook**.
3. **Communicate** — at minimum a status entry in `docs/ops/incidents.md`.
4. **Restore** — execute the runbook.
5. **Post-mortem** — write a short blameless retrospective within
   48 hours.

---

## Why these numbers

The 99.0% / 4h-RTO / 24h-RPO triplet reflects the **current stage of
the operation**: solo founder, no on-call rotation, Firebase managed
infrastructure (no in-house DR). Tightening to 99.5% would require
synthetic monitoring + alerting; 99.9% requires multi-region failover
+ on-call rotation. Both are post-pilot work.

**For the first paid pilot**: this SLO is presentable at the level of
"we commit to the 99.0% / 4h / 24h triplet" with the caveat that we
will publish updated numbers once we have a real measurement window.
Procurement counterparties typically want 99.9% on contractual SLAs;
the path to that is documented above.

---

## Round-7 status

This document is the round-7 R2-NEW-18 closure. Companion artifacts:
- `docs/ops/runbooks/` — 5 stub runbooks (round-7 R2-NEW-19)
- `docs/ops/observability.md` — golden-signal measurement plan (round-7 R2-NEW-20)
- `proof/firestore.indexes.json` — auto-deploys the trace-novelty composite index (anticipated round-7 finding)
