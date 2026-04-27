# Observability — measurement plan

**Status:** Working draft (round-7 R2-NEW-20 closure). Documents the
measurement plan needed to operationalise `docs/ops/slo.md`. Most of
this is "how to do it" rather than "we already do it" — the
infrastructure is ready (Firebase + Cloud Functions emit metrics by
default), we just haven't bookmarked the dashboards.

---

## The four golden signals

For each of the 5 SLO-scoped surfaces (verify.html, JWKS, cme-demo,
signReceipt, onSessionWritten), measure:

1. **Request rate** (req/s) — how much traffic
2. **Error rate** (% of 5xx + JS exceptions) — how much is failing
3. **Latency** (p50, p95, p99) — how fast
4. **Saturation** (% of quota used) — how close to capacity

## Where to find each in Cloud Monitoring

### Firebase Hosting (verify.html, cme-demo.html, JWKS endpoint)

- Console: https://console.cloud.google.com/monitoring/dashboards/builder/firebase-hosting
- Default metrics:
  - `firebasehosting.googleapis.com/network/sent_bytes_count`
  - `firebasehosting.googleapis.com/network/request_count`
- Custom log-based metric needed for JS-exception rate (synthetic
  monitor scrapes the page; counts uncaught errors).

### Cloud Functions (signReceipt + onSessionWritten)

- Console: https://console.cloud.google.com/monitoring/dashboards/builder/cloud-functions
- Default metrics:
  - `cloudfunctions.googleapis.com/function/execution_count`
  - `cloudfunctions.googleapis.com/function/execution_times` (p50/p95/p99)
  - `cloudfunctions.googleapis.com/function/active_instances`
- Custom log-based metrics to add:
  - `signing_failed_count` — filter on log entries containing `signing_failed`
  - `wall_divergent_count` — filter on `server_recompute_divergent`
  - `trace_novelty_low_count` — filter on `trace_novelty_low`
  - `runwall_error_count` — filter on `runwall_error` or `runwall_threw`
  These let us alert on attack patterns (e.g., spike in
  divergent receipts = bot fuzzing attempt).

### Firestore (demos, runs, latest, session_fingerprints)

- Console: https://console.cloud.google.com/firestore/databases/-default-/usage
- Default metrics:
  - Reads/sec, writes/sec, deletes/sec
  - Storage size per collection
- Per-collection alerts (round-6 specifically the trace-novelty
  collection):
  - `session_fingerprints` storage > 100 MB → page (TTL not working)
  - `session_fingerprints` write rate > 1000/min → likely bot fuzzing

---

## Synthetic monitoring (queued — R2-NEW-23)

**What's needed:** a Cloud Monitoring Uptime Check that hits
`/verify.html` and `/.well-known/attention-pubkey.json` from 3 regions
every 60s, with a 5-minute "2 of 3 failed" alert threshold.

**Configuration** (when wired):
```yaml
- name: sws-verify-html-uptime
  monitored_resource: uptime_url
  uri: https://sws-attention-proofs.web.app/verify.html
  check_interval: 60s
  regions: [us-central1, europe-west1, asia-east1]
  expected_status: 200
  
- name: sws-jwks-uptime
  uri: https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json
  check_interval: 60s
  regions: [us-central1, europe-west1, asia-east1]
  expected_response_contains: '"keys":'
```

This is the missing piece. Without it the SLO is unmeasured.

---

## Burn-rate alerting (queued — depends on synthetic monitoring)

When uptime checks are wired, configure burn-rate alerts at:
- 5% of monthly error budget burned in 1 hour → page
- 10% burned in 6 hours → escalate
- 50% burned in 30 days → freeze releases

Cloud Monitoring's [SLO burn rate alerts](https://cloud.google.com/monitoring/alerts/concepts-slo-burn-rate)
do this directly once the SLO object is configured.

---

## Wall-specific metrics (round-7 add)

These let us empirically calibrate the wall's parameters
(R5-NEW-9 / DIVERGENCE_THRESHOLD calibration debt):

- **`server_recompute_divergent_rate`** — fraction of receipts
  flagged divergent. A real-pilot baseline distribution lets us
  tune the 0.30 threshold.
- **`trace_novelty_low_rate`** — fraction of receipts flagged as
  potential replays. Pilot baseline lets us validate the 1-hour
  lookback window + 5-bucket fingerprint coarseness.
- **`trust_tier_distribution`** — how often each tier fires
  (server_attested / bounds_clean / no_event_log / no_trace_novelty
  / bounds_violated). Production legitimate-traffic should be
  >95% server_attested; anything else is a calibration problem.

---

## Logging hygiene

Existing logs already redact 32+ char hex strings to `<REDACTED>`
(round-1 audit Apr 21 fix). When adding new log lines:
- NEVER log the private key, raw event log, or reflection text
- DO log the receipt hash, kid, trust_tier, server_recompute summary
- DO log error codes (`signing_failed`, `runwall_error`)
- structured logging (JSON, not concat strings) so log-based metrics work

---

## What we don't measure today

| Gap | Why it matters | Closing |
|---|---|---|
| Synthetic uptime monitor | The SLO is aspirational without measurement | R2-NEW-23 (queued) |
| Burn-rate alerting | We won't see incidents until customers tell us | depends on uptime monitor |
| Wall-specific metrics dashboard | Can't empirically calibrate thresholds | R7-NEW (queue after this batch) |
| App Check on Firestore writes | Cost-DOS attacks aren't bounded | R2-NEW-21 (queued) |
| Billing budget + kill-switch | $50/mo cap doesn't enforce itself | R2-NEW-22 (queued) |

---

## Round-7 status

This document is the round-7 R2-NEW-20 closure. Companion:
`docs/ops/slo.md` (R2-NEW-18), `docs/ops/runbooks/*` (R2-NEW-19).
The infrastructure is ready; what's left is the actual wiring of
synthetic monitors + burn-rate alerts, which is procurement-budget-
gated rather than engineering-gated.
