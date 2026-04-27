# Hardening Plan — SWS Attention Protocol

**Origin:** 2026-04-27 hostile-review round dispatched 8 skeptic agents in parallel (security red-team, statistics, business, code-quality, competitive, legal, SRE, UX). Each returned a ranked attack list. Four were fixed immediately in commit `d43ba3b`; the rest live here as the durable improvement queue.

**How this doc is used:** every batch of work picks the next N items in priority order, fixes them, validates with `npm run test:flow` + `npm test`, commits, pushes. After each batch we re-dispatch the skeptic round so each round attacks the *current* state. Iteration continues until a fresh round surfaces no new findings at the current severity tier.

**Last updated:** 2026-04-27 after commit `d43ba3b`.

---

## Severity tiers

| Tier | Definition | Time to fix per item |
|---|---|---|
| **T1** | Non-negotiable for paid pilot. Blocks pharma/gov/banking enterprise procurement. Either security-load-bearing or legal-blocking. | Days to weeks |
| **T2** | Credibility blockers a careful reviewer (YC partner, stats reviewer, security review) catches in 5 minutes. | Hours |
| **T3** | Fundability + business gaps. Not engineering. | External (LOIs, counsel, etc.) |

---

## Closed (commit d43ba3b)

- [x] **LEGAL BLOCKER** Strip ACCME/AMA protected marks from `proof/cme-demo.html`. Replaced with "DEMONSTRATION TIER · FICTIONAL ACCREDITOR" + non-affiliation language above the fold.
- [x] **SECURITY CRITICAL** Path traversal in `scripts/test-cme-flow-narrative.js` static server. Now `path.resolve` + `startsWith(allowedRoot + path.sep)`.
- [x] **BUG CRITICAL** Conformal CI race in `proof/cme-demo.html`. `getConformalAnalysis` called once, passed through to both display and receipt.
- [x] **PRIVACY** PII gitignore for `proof/real_tests_apr26/`, `proof/Results-*.zip`, `public/proof/Results*.zip`.

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
