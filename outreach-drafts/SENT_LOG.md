# Outreach Sent Log

Durable record of every cold-discovery email sent. One entry per send. Append-only.

---

## 2026-05-07 — PPP — Jane Eckstein

- **Sent:** 11:51 AM ET
- **To:** jeckstein@psychiatrist.com
- **Recipient:** Jane Eckstein, Managing Director, CME Institute, Physicians Postgraduate Press, Inc. (Memphis / Germantown, TN)
- **Subject:** Customer development — psychiatry-CME measurement question
- **Body source:** `outreach-drafts/01-ppp-SEND-THIS.md` (May 7 locked version)
- **Hardest expected question:** *"How does this look to ABPN?"* — locked answer in `CALL_CHEAT_SHEET_PPP.md`
- **Second-hardest expected question:** *"What's a good score?"* — locked calibration-protocol answer, backed by `docs/threshold-derivation-methodology.md`
- **Follow-up due:** 2026-05-14 (7-day bump if no reply); calendar reminder staged
- **Reply:** pending
- **Prep artifacts available at send time:**
  - `BRIEFING_PPP_v2.md` — full discovery briefing
  - `outreach-drafts/CALL_CHEAT_SHEET_PPP.md` — live-call cheat sheet
  - `outreach-drafts/PPP_GLOSSARY.md` — every term defined
  - `docs/threshold-derivation-methodology.md` — calibration protocol (shipped same day)
- **Notes:** First cold-discovery send post-YC-S26 submission. Practice round 1 per `OUTREACH_PLAY.md`. Stephen offline May 8–10; reply handling resumes Sun May 11 or Mon May 12.

### Same-day P0 incident — production signing path (fixed)

- **Discovered:** 2026-05-07 ~13:00 ET, while verifying the methodology doc's `<2% receipt-failure rate` claim.
- **Severity:** HIGH (functional, not architectural). Production signing path returning `bad_signing_key` for 100% of attempted signs since 2026-04-27 (10 days, 17 failed sessions).
- **Root cause:** Firebase deploy on 2026-04-27 (commit `bdfe797`) shipped the `defineSecret('SWS_SIGNING_KEY')` reference but the deployed function never bound to the secret value because (a) Firebase's source-hash diff skipped subsequent deploys, and (b) the runtime service account `420661886092-compute@developer.gserviceaccount.com` lacked `secretmanager.secretAccessor` on `SWS_SIGNING_KEY` and `SWS_SIGNING_KID`. `SIGNING_KEY.value()` returned empty, the regex check failed, error thrown.
- **Fix path:**
  1. Added deploy-marker comment to `proof/functions/index.js` to invalidate the source hash and force a real redeploy.
  2. Re-`firebase functions:secrets:set` for both secrets (creates v2, auto-grants IAM to the runtime service account).
  3. Redeployed functions to bind v2 of both secrets.
- **Verification:**
  - Synthetic session `demo_signfix_test2_1778173930755` signed successfully at 17:12:24 UTC.
  - JWT verifies end-to-end against the live JWKS at `sws-attention-proofs.web.app/.well-known/attention-pubkey.json` (kid `sws-attention-2026-04`).
  - Payload iat / exp valid.
- **Methodology-doc claim softened:** `<2% receipt-failure rate` rewritten to "target <2%, measured against deployer's actual production sample during pilot setup" — honest forward posture, no vendor-wide rate claim until we have post-fix production data.
- **Lesson:** the 7 hardening rounds didn't catch this because no round explicitly measured *production HTTP signing success rate over a real-user sample*. Adding that to the SLO/runbook stack is queued.

### Same-day P1 finding — Wall silently inactive on real users (R8-NEW-3, fixed in `68e3db9`)

- **Discovered:** 2026-05-07 evening, while tightening the corpus.
- **Severity:** P1 correctness gap. Not a crash or visible bug, but the Wall (R2-NEW-2 server-recompute + R2-NEW-2b trace-novelty) — the most expensive defense layer we ship and the one that sets bypass cost at $5k–20k/mo — was reading `session.event_log` (top-level), while the production demo flow ships `event_log` nested at `session.receipt_payload.event_log` via the SDK's signed canonical payload. Synthetic / harness sessions used top-level so all our tests reported the Wall as working.
- **Empirical confirmation pre-fix:** of last 20 production sessions, 5 had top-level event_log (all synthetic stress-test data I wrote earlier in the day) and 2 had `receipt_payload.event_log` (LLM-harness + one demo session). Real demo sessions: 0 exercised the Wall.
- **Fix:** one-line fallback in both signing paths (HTTP `signReceipt` + Firestore-trigger `onSessionWritten`): `event_log = session.event_log || session.receipt_payload?.event_log || null`.
- **Verification:** production-shape synthetic session (event_log only at receipt_payload.event_log) now returns `trust_tier: server_attested` with fingerprint `fp2:7:48:42:55:4` and active server recompute. Pre-fix it would have returned `trust_tier: client_attested_no_event_log` with no Wall engagement.
- **Implication for outreach claims:** the bypass-cost shift to $5k–20k/mo (cited in adversary-analysis-2026-05-07.md and pitch material) only becomes operationally real after this commit. Pre-`68e3db9`, the documented bypass cost overstated production resistance.
- **Lesson:** the cross-tier audit pattern (client SDK → Firestore document shape → trigger read paths) wasn't exercised by any skeptic round. Round 8 should add it as a recurring check.

---
