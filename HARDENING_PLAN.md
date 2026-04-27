# Hardening Plan — SWS Attention Protocol

**Origin:** 2026-04-27 hostile-review round dispatched 8 skeptic agents in parallel (security red-team, statistics, business, code-quality, competitive, legal, SRE, UX). Each returned a ranked attack list. Four were fixed immediately in commit `d43ba3b`; the rest live here as the durable improvement queue.

**How this doc is used:** every batch of work picks the next N items in priority order, fixes them, validates with `npm run test:flow` + `npm test`, commits, pushes. After each batch we re-dispatch the skeptic round so each round attacks the *current* state. Iteration continues until a fresh round surfaces no new findings at the current severity tier.

**Last updated:** 2026-04-28 after round-2 hostile review (9 parallel skeptic agents, including 2 new roles: cryptography deep-audit + adversarial bot designer). Round 2 fixes landed in commits `f9bf3a7` → `5cbf32f` (5 commits). Round-2 closed list and newly-surfaced queue are below the round-1 sections.

---

## Severity tiers

| Tier | Definition | Time to fix per item |
|---|---|---|
| **T1** | Non-negotiable for paid pilot. Blocks pharma/gov/banking enterprise procurement. Either security-load-bearing or legal-blocking. | Days to weeks |
| **T2** | Credibility blockers a careful reviewer (YC partner, stats reviewer, security review) catches in 5 minutes. | Hours |
| **T3** | Fundability + business gaps. Not engineering. | External (LOIs, counsel, etc.) |

---

## Closed in commit `d43ba3b` (2026-04-27)

- [x] **LEGAL BLOCKER** Strip ACCME/AMA protected marks from `proof/cme-demo.html`. Replaced with "DEMONSTRATION TIER · FICTIONAL ACCREDITOR" + non-affiliation language above the fold.
- [x] **SECURITY CRITICAL** Path traversal in `scripts/test-cme-flow-narrative.js` static server. Now `path.resolve` + `startsWith(allowedRoot + path.sep)`.
- [x] **BUG CRITICAL** Conformal CI race in `proof/cme-demo.html`. `getConformalAnalysis` called once, passed through to both display and receipt.
- [x] **PRIVACY** PII gitignore for `proof/real_tests_apr26/`, `proof/Results-*.zip`, `public/proof/Results*.zip`.

## Closed in commit `329a5a0` (2026-04-27)

- [x] **T2-1** Honest Bayes-classifier framing — dropped "Conformal Bayesian Posterior" misnomer + Vovk-Gammerman citation. On-screen label "Bayesian Posterior P(human)"; receipt method string accurately describes class-conditional Gaussian likelihood ratio; methodology doc §0 explains the rename.
- [x] **T2-3** "23-SIGNAL RECEIPT" → "23-SIGNAL RECEIPT (21 weighted + 2 diagnostic)" on `proof/cme-demo.html` banner.
- [x] **T2-4** Soften 21 CFR Part 11 marketing — `proof/part-11.html` now reads "How SWS Supports Your Validation Program," with explicit "NOT a validated system; customer remains responsible for VMP/IQ/OQ/PQ/§11.100(c)(2)" disclaimer above the fold.
- [x] **T2-5** Hash reflection text in Firestore — saveSession now stores SHA-256 + byte length + word count instead of cleartext. The receipt's `noContentRecorded:true` privacy claim is no longer false in the CME flow.
- [x] **T2-10** Surface caller-supplied calibration override in `getConformalAnalysis` result. Decision-grade verifiers MUST reject receipts where `calibration_override === true`.

## Closed in commit `fef4c20` (2026-04-27)

- [x] **T2-12** env-gate race — missing/errored env-check now fires `environmental:unresolved` gate. No more silent bypass when BotD ESM is blocked or rate-limited.
- [x] **T2-6** URL-fragment overflow on Verify link — canonical now stashed in sessionStorage keyed on hash; fragment carries only hash for receipts above the 1.6KB budget. Outlook/Slack/iPad clients no longer truncate the verify path.

## Closed in commit `acc9769` (T1-3 WCAG quiz buttons, 2026-04-27)

- [x] **T1-3** WCAG 2.1 + Section 508 quiz keyboard accessibility — converted `<div class="opt">` to `<button type="button" class="opt" role="radio" aria-checked>`, wrapped each question's options in `role="radiogroup" aria-labelledby`, added `<label for="reflection">` and `aria-describedby` for word counter, added `role="progressbar"` with valuenow updates, added `<header>` + `<main>` landmarks + visible-on-focus skip-link. Native button elements give keyboard activation (Enter/Space) for free. Screen-reader users now get group/role/state announcements; keyboard-only users can complete the entire flow without a mouse. **Note:** roving-tabindex pattern (W3C ARIA-Practices recommended for radiogroup) is NOT yet implemented — all options are tabbable in DOM order. That's WCAG 2.1.1 (Keyboard) compliant but not the textbook ARIA radiogroup. Queued as T1-3.5 below.

## Closed in next commit (T2-2 small-N honesty, 2026-04-27)

- [x] **T2-2** Bootstrap CI honesty at small N — receipts now carry `calibration.small_n_caveat: true` and a `small_n_caveat_note` string when either class has n<20. The on-screen meta line shows "Bootstrap CI (wide, approximate at small N)" instead of "95% bootstrap CI" until both classes reach n=20. Drops automatically when calibration grows. Doesn't replace the n_h≥30 work in T1-4 — this is honest disclosure of what the current CI actually represents.

## Newly identified (round 1, 2026-04-27)

- [ ] **T1-3.5** Roving-tabindex on radiogroups — only the selected (or first) radio is tabbable; arrow keys move focus + selection within the group. W3C ARIA-Practices canonical pattern. Estimate 2-3 hours.

---

## Round 2 closed (2026-04-28, 5 commits)

### Commit `f9bf3a7` — T0 batch 1: Firestore + verify.html JWT hardening
- [x] **R2-1** Firestore rules world-readable to any anon-auth user — closed.
      `demos` is now create-only with uid-binding + 50-field / 64KB cap;
      reads admin-only via Firebase custom claim. `runs` admin-only. `latest`
      stays public-read (the curated proof-gallery design). Updates / deletes
      denied across the board. Migration of pre-2026-04-28 docs with
      cleartext reflection still queued — see R2-NEW-1 below.
- [x] **R2-2** verify.html JWKS kid-confusion (`|| jwks.keys[0]` fallback) —
      closed. Strict kid match; rejects unmatched kid.
- [x] **R2-3** verify.html `exp` / `iss` / `nbf` not enforced — closed.
      Mirrors Node-side checks (300s clock skew, ACCEPTED_ISSUERS allowlist,
      vc.issuer.id ↔ jwt.iss cross-check). Sample JWT (no exp claim) still
      verifies as before; an old or wrong-issuer JWT now renders an explicit
      "Receipt rejected — expired / unknown_issuer" verdict.
- [x] **R2-4** `calibration_override` / `small_n_caveat` flags surfaced but
      not consumed by any verifier — closed. Renders an explicit "do not
      use for decision-grade verification" banner when present.

### Commit `b8f1ae8` — T0 batch 2: tier-aware narrative on demo.html + signal-count fix
- [x] **R2-5** demo.html still painted "WHY THIS IS BIOLOGICALLY HUMAN" on
      PASSIVE / BACKGROUND tiers (round-1 fix landed only on cme-demo.html)
      — closed. Title now verdict-keyed; bio-narrative copy suppressed for
      non-human tiers.
- [x] **R2-6** Stale "23-SIGNAL (21 weighted + 2 diagnostic)" copy across
      cme-demo banner / breakdown header / composite-sub / demo subtitle /
      proof/index.html — closed. SDK is 20 weighted (oneOverFCoherence,
      microsaccades zero-weight; submovementCount 0.05 documented as
      defeated). Now consistently "20 weighted + 3 diagnostic."

### Commit `28e466f` — T0 batch 3: receipt-composite hardening
- [x] **R2-7** `src/sdk/receipt-composite.js` env-gate had no 'unresolved'
      branch — closed. cme-demo.html had a bespoke fix in fef4c20; the SDK
      module now has the same defense. An attacker monkey-patching
      SWSEnvironmentalGate.check() to return `{loaded:false, error:...}`
      no longer evades the cap.
- [x] **R2-8** `inputs.gates` caller-supplied override silently honored —
      closed. Result now exposes `gatesOverridden:true` so a verifier can
      reject (mirrors calibration_override pattern).
- [x] **R2-9** cme-demo.html inline gating missed `'suspicious'` composition
      verdict — closed. Now caps at 0.50 (mid-cap, less aggressive than the
      hard 0.30 paste/mechanical cap because the verdict is softer); new
      explainGate branch.

### Commit `0c1b4a2` — T1 batch 1: a11y propagation
- [x] **R2-10** Receipt panel render not announced to screen readers —
      closed. `role="region" aria-live="polite" tabindex="-1"` on `#results`;
      finishActivity focuses it. WCAG 4.1.3 (Status Messages) + 2.4.3
      (Focus Order).
- [x] **R2-11** No double-submit guard on `Submit for Credit` — closed.
      Disables + relabels on click; idempotent guard prevents duplicate
      Firestore sessions on slow Cloud Function calls.
- [x] **R2-12** MARGINAL / FAIL UX dead-end — closed (stopgap until T2-8
      review queue). Inline "Disagree with this verdict? request review →"
      mailto with receipt hash + session id + composite pre-filled.
- [x] **R2-13** verify.html / index.html / for-reviewers.html /
      receipt-explorer.html had zero landmarks, no skip-link — closed.
      Each surface now has `<header role="banner">` + `<main id="main"
      tabindex="-1">` + visible-on-focus skip-link.
- [x] **R2-14** verify.html + receipt-explorer.html textareas had only
      placeholders for labels (WCAG 1.3.1 + 3.3.2 fail) — closed. sr-only
      `<label for="...">` for each.
- [x] **R2-15** No `prefers-reduced-motion` honored on verify.html — closed.
- [x] **R2-16** No print styles — closed. verify.html now renders
      receipt-binder-friendly black-on-white.

### Commit `5cbf32f` — T1 batch 2: BIPA / consent
- [x] **R2-17** Internal contradiction: COMPLIANCE_MATRIX said "Biometric:
      NO" while index.html / part-11.html marketed "behavioral biometrics"
      — closed. SWS-self-marketing now says "behavioral-signal analysis"
      / "aggregate behavioral statistics." Competitor references (BioCatch
      etc) stay as-is. Compliance Matrix row reconciled with explicit BIPA
      §10 / TX SB 800 / WA HB 1493 statutory citations.
- [x] **R2-18** No written legal posture for the "we don't collect biometric
      identifiers" theory — closed (working draft). `docs/legal/bipa-
      posture.md` documents the §10 enumerated-types theory + residual risks
      + path-(a) vs path-(b) decision + pre-pilot action items. Pending
      counsel sign-off.
- [x] **R2-19** Flagship cme-demo.html had no consent banner (round 1 fixed
      lots of cme-demo bugs but never wired in consent) — closed.
      `SWSPrivacy.showConsentBanner()` fires before SDK init; auto-skips on
      `navigator.webdriver` or `?ap_test=1` so automation isn't blocked.

---

## Round 2 newly-queued (open after round-2 fixes)

### Tier 1 (non-negotiable for paid pilot)

- [ ] **R2-NEW-1** Migrate pre-2026-04-28 `demos/*` Firestore docs that
      contain cleartext reflection text. The new rules deny non-admin
      reads, so the data is not exposed via the public dashboards anymore,
      but the cleartext still sits in Firestore. Author a migration script
      that hashes the reflection field on existing docs, deletes the
      cleartext, and logs the old doc count.
- [ ] **R2-NEW-2** Server-side scoring path (was T1-1; restated). The
      adversarial bot-builder agent designed a working bypass (composite
      ≥0.700 from a fully-automated pipeline) at ~$50 / 56 engineer-hours
      using puppeteer-extra-stealth + recorded-human-trace replay + per-char
      keyboard.type + a CSS-aware DOM reader (honeypot canary bypassed by
      filtering computedStyle visibility:hidden + Unicode-tag stripping).
      No SDK monkey-patching required. Server-side recompute + trace-novelty
      k-NN rejection is the only meaningful defense. **Critical for any
      paid pilot.** Estimate 2-3 weeks.
- [ ] **R2-NEW-3** Bot calibration cluster-correlation fix. The 28 bot
      composites are 14 dmtg + 4 stealth + 10 prior — i.e., 2-3 harness
      families with within-family SDs of 0.019 and 0.003 (implausibly low
      for i.i.d. samples). ICC ≈ 0.81; design-effect ≈ 7; effective n_b ≈ 4.
      Trip `small_n_caveat` on `min(n_h, n_b_effective) < 20`, not raw n_b.
      Posterior P(human|0.55) computed honestly is 0.425, not the 0.7+
      the methodology doc implies. Fit a 2-component Gaussian mixture for
      the bot likelihood, or use empirical CDF / KDE. Document the math.
- [ ] **R2-NEW-4** Calibration class-definition leakage (was T1-4).
      Restated with explicit math: with σ_h floored to 0.05, *any* genuine
      non-Stephen typist whose composite is ≥0.05 from Stephen's mean
      lands in the bot likelihood region. Realistic non-Stephen HCPs
      (esp. age ≥55) score systematically lower; realistic FRR ≥30%.
      Before any pilot, compute and ship a worst-case FRR bound from
      published HCP-population age/typing-speed distributions.

### Tier 2 (credibility blockers a careful reviewer catches)

- [ ] **R2-NEW-5** JWKS per-kid validity windows. RFC 7517 doesn't mandate
      validity windows but the rotation plan keeps the OLD key live for a
      7-day grace window; an attacker with the leaked old key can mint
      receipts dated *after* the rotation and the verifier accepts them.
      Add `sws_validUntil` per JWK; verifier rejects when
      `payload.iat > jwk.sws_validUntil`.
- [ ] **R2-NEW-6** OTS Bitcoin block-time vs `iat` cross-check. OTS proves
      "this hash existed by block N" — not "the receipt was signed at
      block N." An attacker with a leaked private key can pre-stamp any
      future hash and back-date the JWT. verify.html should warn when
      `|parseISO(issuanceDate) - parseISO(bitcoinBlockTime)| > 24h`.
- [ ] **R2-NEW-7** RFC 3161 cert-chain validation in browser. Currently
      `attention-tsa.js` says verify is structural-only and `verify.html`
      shows "signed by FreeTSA" purely from the receipt's self-reported
      `status`. An attacker can include any well-formed-but-unverified TSA
      token and the verifier shows it as signed. Use `@peculiar/x509` to
      verify the signerInfos signature against the embedded TSA cert chain.
- [ ] **R2-NEW-8** Receipt hash domain excludes `application_id` and
      `proof.hash_ids`. Same hash satisfies two different originating apps
      (cross-app replay). Either include them in canonical, or document the
      exclusion explicitly.
- [ ] **R2-NEW-9** Pure-JS SHA-256 fallback in `attention-receipts.js:442`
      silently returns `''` on any byte > 0x7F — cleartext with non-ASCII
      (UTF-8 multibyte, smart quote, em-dash, accented user name) on a
      legacy-Safari iframe yields empty-string hash → trivial collision.
      TextEncoder the input first.
- [ ] **R2-NEW-10** Canonical JSON not RFC 8785: no Unicode NFC
      normalization, ad-hoc number serialization. Two NFC-vs-NFD inputs
      with same logical content yield different hashes ("naïve" typed via
      NFC vs NFD). Either adopt the npm `canonicalize` (~1KB) or document
      that canonical assumes NFC and integer/short-decimal numerics + NFC-
      reject at `generateReceipt`.
- [ ] **R2-NEW-11** `onSessionWritten` Cloud Function trusts client-supplied
      `composite` / `environmental` / `composition_integrity` and signs
      the JWT directly. A client passing `{signals.composite:0.99,
      environmental:{loaded:true,bot:false}, composition_integrity:{
      verdict:'authored'}}` gets a real Ed25519-signed receipt that
      verifies green. Subsumed by R2-NEW-2 server-side scoring; until that
      lands, add bounds checking — `composite > 0.85 requires
      environmental.loaded + ci.verdict==='authored' + duration_ms > 60s
      + interaction_count > 10` — and tag the JWT `tier:client_attested`
      vs `tier:server_recomputed`.
- [ ] **R2-NEW-12** Drop the `toJwt()` (unsigned `alg:none`) export from
      `verifiable-credentials.js`. Verify.html correctly rejects it but a
      third-party integrator using jose/PyJWT with `verify=False` could
      treat it as authentic.
- [ ] **R2-NEW-13** `_generateSubjectDid` 32-bit Java-style hash for
      "anonymizing" userId — no salt, deterministic, exhaustive enumeration
      recovers userId in seconds for any small org. Replace with HMAC-
      SHA-256(server-secret, userId) truncated to 128 bits.
- [ ] **R2-NEW-14** `attention-merkle.js` — leaves are raw 32-byte SHA-256
      with no `0x00`/`0x01` domain-separation prefix (RFC 6962 standard).
      Second-preimage flexibility on internal-node hashes.
- [ ] **R2-NEW-15** verify.html error tokens (`jwt_malformed_expected_3_parts`
      etc) leak as raw to non-technical reviewers. Map to plain-language
      strings; keep raw token in `<details>` for engineers.
- [ ] **R2-NEW-16** Mobile signal-degradation not surfaced in cme-demo
      receipt UI. Touch-device users get 4 mouse signals reading 0; the
      composite is reweighted but the receipt panel doesn't say so.
      Banner: "Touch device detected — 4 mouse-based signals not
      applicable."
- [ ] **R2-NEW-17** verify.html dates rendered as raw ISO strings, not
      user locale. Wrap with `toLocaleString({ dateStyle:'medium',
      timeStyle:'short' })`.

### Tier SRE (production-readiness gaps; round-2 confirms round-1's
"5–6 weeks hardening" estimate stands; no infra cost on the trio below)

- [ ] **R2-NEW-18** `docs/slo.md` — commit to 99.0% verify-path
      availability over 30-day windows, RTO ≤ 4h, RPO ≤ 24h, with
      explicit out-of-scope for OTS / TSA SPOFs. (1 hour of writing.)
- [ ] **R2-NEW-19** `docs/runbooks/{signing-key-rotation,jwks-outage,
      firestore-failover,billing-overrun,verify-html-5xx}.md` — even one
      page each. (Half day.)
- [ ] **R2-NEW-20** `docs/observability.md` — bookmark Cloud Monitoring
      URLs for the four golden signals on `signReceipt` + `onSessionWritten`
      + Hosting; turn on Log-based Metrics for `signing_failed` count.
- [ ] **R2-NEW-21** Firebase App Check on `demos` writes + `signReceipt`
      invocation. Round-1 named it; still off. With anonymous-auth +
      auto-signing trigger, an attacker can write 10k bogus demos
      overnight and burn Cloud Functions / Secret Manager quota.
- [ ] **R2-NEW-22** GCP Budget at $50/mo with kill-switch Cloud Function
      at 100% (Google's documented pattern).
- [ ] **R2-NEW-23** Cloud Monitoring Uptime Check on
      `https://sws-attention-proofs.web.app/verify.html` and
      `/.well-known/attention-pubkey.json` every 60s from 3 regions.
- [ ] **R2-NEW-24** Pin GitHub Actions to commit SHAs (currently floating
      `@v4` — vulnerable to tag-rewrite supply-chain attack per the
      tj-actions/changed-files March 2025 incident). Add Dependabot
      config for `package-ecosystem: github-actions`.

### Tier Legal (Stephen-driven + counsel)

- [ ] **R2-NEW-25** EU geo-block on cme-demo until GDPR Art. 22(2)(c)
      consent flow + Art. 13(2)(f) per-signal explanation panel + DPIA on
      file. Or alternatively, embed the Art. 22 consent step in the
      banner.
- [ ] **R2-NEW-26** Schrems II: Firestore `sws-attention-proofs` is
      us-central1; EU-tagged users transferring to US needs SCCs + Transfer
      Impact Assessment OR move to `eur3` for EU sessions.
- [ ] **R2-NEW-27** CPRA "Limit the Use of My Sensitive Personal
      Information" link + Sec-GPC handler.
- [ ] **R2-NEW-28** FTO opinion against BioCatch + Plurilock + BehavioSec
      patent estates ($5-8K legal). Without it, "we have a provisional"
      reads as either negligence or willful infringement under §284.
- [ ] **R2-NEW-29** BAA template authored, since first pharma/HCP pilot
      will trigger BA status the moment cleartext touches Cloud Function
      memory (currently it doesn't, but the tail-risk is real).
- [ ] **R2-NEW-30** Counsel review of `docs/legal/bipa-posture.md`.
      Decision: path-(a) "we don't collect biometric identifiers" theory
      vs path-(b) §15(a)/(b)-style consent flow + 3-year retention/
      destruction schedule.

### Tier YC (Stephen-driven; same as round 1 but NONE fixed)

- [ ] **R2-NEW-31** YC application: 0 of 5 T3 items fixed at round-2 time.
      Specifically: T3-1 LOI (none), T3-2 vertical narrowing leak (line
      194 still pitches "20+ vertical audits completed"), T3-3 bottoms-up
      TAM (still says "$600M / 1% of digital analytics"), T3-4 co-founder
      commitment (line 94 still "open to right match"), T3-5 runway
      `[FILL]` (still empty). Hostile YC partner v2 verdict was "NO,
      same as Round 1, with one less excuse — founder spent 24h
      hardening a product that already passes its own tests instead of
      fixing the application that funds the next 12 months."
- [ ] **R2-NEW-32** Strategic moat reframing per competitive v2: the
      defensible long-term asset is the **calibration corpus**, not the
      receipt format. Receipt becomes commoditized in 24-36 months once
      Cloudflare / Credly / Cornerstone ship the same primitive. Pivot
      narrative: "we have the only validated calibration corpus."
- [ ] **R2-NEW-33** Pre-YC Credly mutual-NDA before any product-team demo
      (Credly is BOTH the channel AND the most-likely substitute builder
      — a 6-engineer-week ship for them with their issuer relationships
      intact).

---

## Round 2 verdict snapshot (each agent's one-line verdict)

- **Security v2** — HIGH: kid-confusion + verify.html accepts wrong-iss / no-exp + Firestore world-readable + onSessionWritten trusts client. Three closed in T0 batch 1; onSessionWritten trust queued as R2-NEW-11.
- **Statistics v2** — HIGH: n_b=28 is effectively n=4; trimodal bot fit is mis-specified; P(human|0.55) is 0.425 not 0.7+. Closed: calibration_override now consumed. Queued: cluster-correlated effective-n + Gaussian mixture + bootstrap coverage simulation.
- **Code-quality v2** — HIGH: stale "23-SIGNAL" + receipt-composite gate-override silent + suspicious-verdict bypass + env error-blob persisted unbounded. Closed: stale labels + gate-override surfacing + suspicious gate. Queued: env error-blob narrowing.
- **UX/a11y v2** — HIGH: receipt-render not SR-announced + JWT exp not enforced + demo.html still paints "biologically human" on FAIL + 4 sibling surfaces have no landmarks. ALL closed in T1 batch 1.
- **SRE v2** — HIGH: zero ops doctrine. SLO/runbooks/dashboards/synthetic/budget/App Check all MISSING. Round-1 estimate of 5-6 weeks hardening stands.
- **Legal v2** — CRITICAL: BIPA exposure; consent banner missing; GDPR Art 22 ungated; Firestore world-readable. Marketing/Compliance contradiction closed in T1 batch 2 + bipa-posture.md authored. Consent banner closed. Firestore closed in T0 batch 1. Art 22 + Schrems II + FERPA + FTO queued.
- **Hostile YC partner v2** — NO. Same answer as Round 1 with one less excuse. 0 of 5 T3 items fixed. Stephen-typed, blocked on outreach + writing.
- **Cryptography deep audit (NEW)** — MEDIUM-HIGH: kid-confusion (closed) + verify.html exp (closed) + JWKS validity-window + OTS cross-check + RFC 3161 cert-chain + canonical-not-RFC-8785 + SHA-256 fallback empty-string + receipt-hash domain excludes app_id. Three closed in T0 batch 1; rest queued.
- **Adversarial bot builder (NEW)** — CRITICAL: composite ≥0.700 bypass at $50 / 56h with off-the-shelf libraries. No SDK monkey-patching. Three integrity gates individually defeatable, multiplicatively independent. **Server-side scoring (T1-1 / R2-NEW-2) is the only meaningful defense.**
- **Competitive v2** — HIGH: BioCatch is NOT the existential threat — Cornerstone / Credly / Articulate are. Receipt-as-product is commoditized in 24-36 months; defensible asset is the calibration corpus. Patent FTO is genuinely shaky vs BehavioSec + Plurilock. Strategic, not engineering.

---

## Tier 1 — non-negotiable for paid pilot

### T1-1. Server-side scoring path (close client-side trust root)
**Problem:** `SWSAttention.getHumanConfidence()` runs in the customer's browser. A 30-minute monkey-patch in DevTools (`SWSAttention.getHumanConfidence = () => ({composite: 0.78, signalActive: {...all true}})`) produces a cryptographically valid receipt for fabricated signals. The "content-bound" property is real but commits only to the bytes the client chose to commit to.
**Fix path:** thin "raw-event uploader → server-side scorer → server-signed JWT" path. Client reports raw event timeline; server recomputes composite + signs. Deprecate client-only content receipts for any decision-grade use.
**Estimate:** 2–3 weeks for scorer service + Cloud Run deploy + verifier flow update.
**Done when:** `cme-demo.html` flow produces receipts where the composite was computed by `api.swsprotocol.com` and the JWT signature covers the server's recomputation.

### T1-2. Receipt-bound challenge / audience / expiry
**Problem:** Canonical commits to self-generated `nonce`. Not bound to user, origin, audience, or expiry. A receipt earned for activity A is replayable as proof for activity B by any other user.
**Fix path:** server mints `{nonce, audience, expiry, activity_id}` at session start; canonical includes them; verifier checks audience + expiry + one-time-use ledger.
**Estimate:** 1 week (depends on T1-1's server path being available).
**Done when:** verifier rejects a receipt presented for a different `audience` than the one bound at issuance.

### T1-3. WCAG 2.1 AA / Section 508 pass on cme-demo
**Problem:** Quiz options are `<div class="opt">` — no role, no tabindex, no keyboard activation, no aria-checked. Screen-reader users and keyboard-only users **cannot answer**. Hard fail under §1194.22 + WCAG 2.1.1 + 4.1.2.
**Fix path:** convert to `<button role="radio">` inside `<div role="radiogroup" aria-labelledby>`; add `<label for="reflection">`; add `role="progressbar" aria-valuenow` to progress bar; add `<main>` and skip-link; lift verdict-pill text to ≥4.5:1 contrast; run axe-core in CI.
**Estimate:** 1–2 days.
**Done when:** axe-core reports 0 critical/serious violations on `cme-demo.html`, `verify.html`, `index.html`.

### T1-4. Calibration set expansion to n_h ≥ 30, unrelated subjects
**Problem:** n_h=5 with 4-of-5 being Stephen → developer-as-class-definition leakage. Unknown false-rejection rate against actual HCP audience. ADA exposure.
**Fix path:** corpus collection program already exists (`docs/corpus-collection-kit.md`, `scripts/corpus-status.js`). Run it. ≥30 unrelated subjects, ≥3 sessions each. Pre-register inclusion criteria. Hold out Stephen's data as test set, do not include in calibration.
**Estimate:** 4–6 weeks of data collection + 1 day to roll into `DEFAULT_CALIBRATION` v3.
**Done when:** `DEFAULT_CALIBRATION.human_scores.length ≥ 30`, `version === 'v3-corpus'`, methodology doc updated, none of the human scores trace to Stephen.

### T1-5. MSA + DPA + SLA + EULA + LoL framework + entity formalization
**Problem:** No Terms of Service, no MSA, no DPA, no LoL clause. Forged-receipt → fraudulent CME → patient injury → uncapped exposure for SWS Strategic Media LLC (which itself is unincorporated per memory).
**Fix path:** Delaware C-corp conversion ($1.5–4K via Stripe Atlas/Clerky); IP assignment to corp; counsel-drafted MSA + DPA + SLA + EULA with mutual indemnity, LoL = 12 months fees, gross-negligence carve-out, IP indemnity capped, $2M cyber + $5M E&O insurance ($20–40K/yr premiums).
**Estimate:** $8–15K legal + 2–4 weeks elapsed. Stephen-driven, not engineering.
**Done when:** signed certificate of formation, IP assignment, paper templates ready to hand a procurement counterparty.

---

## Tier 2 — credibility blockers (hours each)

### T2-1. Rename "conformal" everywhere → "bayes_analysis" or "posterior_analysis"
**Problem:** What we ship is a class-conditional Gaussian likelihood ratio with flat prior. Citing Vovk-Gammerman-Shafer 2005 in the receipt's `method` field is jargon laundering. A stats-trained reviewer (any ML PhD, any biostatistician) flags it instantly.
**Fix path:** rename the function and the receipt field; drop the Vovk-Gammerman + Angelopoulos-Bates citations from `method`. Keep them as related-work refs in `docs/yc-defense/11_calibration_methodology.md` only. Either implement actual split-conformal later or never call this conformal again.
**Estimate:** 1 commit, ~1 hour.
**Files:** `src/sdk/attention-protocol.js` (line ~2915 `getConformalAnalysis`), `proof/cme-demo.html` (line ~605 onward), `proof/receipt-explorer.html`, `proof/for-reviewers.html`, `docs/yc-defense/11_calibration_methodology.md`, `SEVEN_LAYER_DEEP_DIVE.md`.

### T2-2. Bootstrap CI honesty at small N
**Problem:** Bootstrap on n_h=5 has empirical coverage ~60-70%, not stated 95% (Efron-Tibshirani caution against bootstrap at n<20). Receipt currently advertises "95% bootstrap CI."
**Fix path:** until n_h ≥ 20: either (a) report BCa intervals with explicit coverage simulation, (b) report a credible interval from a proper Bayesian posterior under inverse-gamma σ² conjugate prior, or (c) drop the CI entirely and surface only the posterior point estimate with a "n=X, see methodology" footnote.
**Estimate:** 2-4 hours for option (c); ~2 days for option (b).
**Files:** `src/sdk/attention-protocol.js` (line ~2989 bootstrap loop).

### T2-3. "23 signals" → "20 weighted + 3 diagnostic"
**Problem:** Banner says "23-SIGNAL RECEIPT" but `oneOverFCoherence` (weight 0) and `microsaccades` (weight 0) are diagnostic-only by the SDK's own admission, and `submovementCount` (weight 0.05) is documented as defeated by 60Hz Bezier+jitter bots. A reviewer counting weights or reading the comments calls this out.
**Fix path:** consistent "20 weighted + 3 diagnostic" language across the demo banner, the breakdown panel, the YC application, the deep dive, and the methodology doc.
**Estimate:** 1 commit, ~1 hour.
**Files:** `proof/cme-demo.html`, `proof/for-reviewers.html`, `proof/index.html`, `YC_S26_APPLICATION_DRAFT.md`, `SEVEN_LAYER_DEEP_DIVE.md`.

### T2-4. Strip "21 CFR Part 11 compliant" → "designed to support customer's Part 11 validation"
**Problem:** `proof/part-11.html` and adjacent marketing surfaces frame SWS as Part 11 compatible. Real Part 11 needs validated CSV (IQ/OQ/PQ), audit-trail rotation procedure, §11.100(c)(2) FDA certification letter — none of which exist. Marketing as Part 11 compatible exposes SWS to Form 483 inheritance through the sponsor.
**Fix path:** rewrite the framing from "we satisfy Part 11" to "we provide a tamper-evident artifact that the customer's validated system can incorporate." Add explicit "NOT a validated system; customer is responsible for IQ/OQ/PQ" disclaimer.
**Estimate:** 2-3 hours.
**Files:** `proof/part-11.html`, `YC_S26_APPLICATION_DRAFT.md`, marketing surfaces in `proof/`.

### T2-5. Reflection text Firestore PII fix
**Problem:** `cme-demo.html:saveSession` pushes the full reflection text (`reflection: reflectionEl.value.slice(0, 2000)`) to Firestore. Receipt JWT carries `evidence: PrivacyAttestation.noContentRecorded:true`. The two are contradictory.
**Fix path:** either (a) hash the reflection before storage and only persist the hash; (b) omit it entirely; (c) update the privacy claim to match reality (which weakens the no-PII story). Recommend (a) — the hash retains the integrity binding without storing content.
**Estimate:** 1-2 hours including a regression test.
**Files:** `proof/cme-demo.html` (saveSession function), receipt schema doc.

### T2-6. URL-fragment overflow on Verify link
**Problem:** Canonical JSON (4-5KB) base64-encoded into `verify.html#auto=1&hash=...&canonical=<b64>`. Outlook, Slack, WeChat, corporate proxies truncate at 2KB. First buyer who clicks from Outlook on iPad gets blank page.
**Fix path:** stash canonical in `sessionStorage` keyed on hash; pass only the 64-char hash in the fragment; verify.html reads from sessionStorage. Falls back to legacy fragment-decode if sessionStorage missing.
**Estimate:** 2-3 hours.
**Files:** `proof/cme-demo.html` (verify-link setter ~line 575), `proof/verify.html` (autoPrefillFromFragment).

### T2-7. Ed25519 polyfill for old browsers
**Problem:** `crypto.subtle.importKey('jwk', jwk, {name:'Ed25519'}, ...)` throws `NotSupportedError` on Chrome <113, Safari <17, Firefox <130 — 15-25% of locked clinical fleets.
**Fix path:** detect feature support, fall back to `@noble/ed25519` (~7KB). Add `crypto_method: 'subtle' | 'noble-fallback'` to receipt.
**Estimate:** 4-6 hours.
**Files:** `proof/verify.html`, possibly add `proof/vendor/noble-ed25519.js`.

### T2-8. MARGINAL review queue page
**Problem:** Verdict pill says "ADDITIONAL REVIEW" but nowhere to review. Stephen's own paste-from-ChatGPT session got MARGINAL — the doctor next steps to nothing.
**Fix path:** ship `proof/review-queue.html` listing Firestore `demos` where `medical_verdict='marginal'`, with reviewer-only auth (Firebase custom claim), approve/deny buttons that write a `review_decision` doc that itself produces a receipt.
**Estimate:** 1-2 days.
**Files:** new `proof/review-queue.html`, Firestore rules update, receipt schema for review decision.

### T2-9. Composition-integrity + slow-typed-LLM defense
**Problem:** Detection rules are: (a) ≥50-char single insert, (b) paste inputType, (c) ≥200 chars/sec at ≥25 char delta. A script reading LLM output and dispatching per-character keydown events with sampled-from-real-user inter-key intervals trips none.
**Fix path:** add typing-while-reading temporal coupling check (no typing during section-read dwell = suspicious); randomized challenge prompt the LLM hasn't seen; cross-reference reflection vocabulary with quiz-answer phrasing.
**Estimate:** 1 week.
**Files:** `src/sdk/composition-integrity.js`, `proof/cme-demo.html`.

### T2-10. Reject caller-supplied calibration in `getConformalAnalysis`
**Problem:** `getConformalAnalysis(0.55, {human_scores:[0.55], bot_scores:[0.0]})` returns p_human ≈ 1.0. Even with default calibration, n_h=5 + SD floor 0.05 means any score ≥0.60 reports P(human) > 0.90. The conformal layer adds zero adversarial robustness — it's an honest-actor calibration only.
**Fix path:** drop the `calibration` parameter from the public API; or require it to be a signed payload from an SWS-controlled origin. Document explicitly that conformal is for honest actors.
**Estimate:** 1 hour.
**Files:** `src/sdk/attention-protocol.js`, methodology doc.

### T2-11. Deduplicate `proof/sdk/` and `src/sdk/`
**Problem:** Two copies of the SDK — `proof/sdk/attention-protocol.js` and `src/sdk/attention-protocol.js`. The npm package's `main` points at `src/`, the CME demo loads from `proof/`. Calibration v2 expansion was applied to both, but a future change risks drift.
**Fix path:** delete `proof/sdk/`; symlink to `src/sdk/`; OR add a build step that copies `src/sdk/*.js` → `proof/sdk/` on every CI run with checksum verification.
**Estimate:** 4-6 hours (need to verify symlink works on Firebase Hosting).
**Files:** `proof/sdk/`, `src/sdk/`, build scripts.

### T2-12. PASSIVE_CAP race when env-gate doesn't load
**Problem:** `cme-demo.html:271` fires `SWSEnvironmentalGate.check()` async; `finishActivity()` reads `window.__swsEnvironmental` without awaiting. If the BotD ESM is rate-limited or 404s, `__swsEnvironmental` is null, `env.bot===true` is false, and the gate doesn't fire. Receipt records `environmental:null`; composite is uncapped.
**Fix path:** treat `env.loaded === false` or null as bot-equivalent for gating; or block submission until env-gate resolves.
**Estimate:** 2-3 hours.
**Files:** `proof/cme-demo.html` (gating logic ~line 510).

---

## Tier 3 — fundability gaps (Stephen-driven, not engineering)

### T3-1. One signed LOI from a named CME provider
**Problem:** YC partner verdict was "no" without a single named CME LOI. Application is theory.
**Fix path:** outreach to Medscape, DKBmed, PlatformQ. Even a free non-binding pilot. Without it, application is cold-pitch theory.

### T3-2. Kill the 7-vertical framing in the YC body
**Problem:** Application body lists market research, CME, pharma GxP, credentialing, nursing homes, FINRA, restaurants, insurance, ad-tech, defense, education. "I haven't picked one" is what the partner reads.
**Fix path:** rewrite YC application body to mention CME only. Other verticals collapse to one sentence: "Same protocol generalizes across regulated attention-verification verticals."

### T3-3. Bottoms-up TAM under $100M for the wedge
**Problem:** "$600M = 1% of US digital analytics" is a fudge that kills credibility.
**Fix path:** SAM = (#ACCME-accredited providers) × (avg ACV). Realistic year-1 SOM under $3M. Replace the application's TAM paragraph.

### T3-4. Co-founder commitment in YC application
**Problem:** YC discounts solo founders 30% on cap. Application doesn't commit to closing one.
**Fix path:** add a sentence: "I will close a technical co-founder by week 4 of the batch."

### T3-5. Honest runway number in YC application
**Problem:** `[FILL]` field in YC draft. Hiding the number is worse than a bad number.
**Fix path:** fill it.

### T3-6. SOC 2 Type 1 / ISO 27001 / FedRAMP roadmap
**Problem:** Every regulated buyer asks first. SWS has none.
**Fix path:** budget $25-50K for SOC 2 Type 1 (Drata/Vanta/Secureframe) once paid pilot signs.

---

## How to run a fresh skeptic round

1. After landing a batch of fixes from this doc, dispatch 8 agents in parallel (security, statistics, business, code-quality, competitive, legal, SRE, UX) with hostile framing + targeted reading list.
2. Each agent reads `HARDENING_PLAN.md` first to see what's already known/fixed; their job is to find what's NEW.
3. Diff their output against this doc. Anything new gets added; anything fixed gets crossed off.
4. Iterate until a fresh round surfaces no new T1 or T2 findings at the current tier.

The pattern produced ~5000 words of actionable critique in <2 minutes wall-clock on 2026-04-27 because the agents ran in parallel. Repeat the round after every commit batch worth ≥4 items closed.
