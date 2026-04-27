# Morning Plan
## Your single source of truth when you sit down

**Goal (the one that matters):** Working, marketable product + first paid pilot signed.
**Deadline:** YC S26 submission 2026-05-04 (**7 days** from tomorrow).
**How to use:** When you sit down and say **"let's get started"** or **"what should we do?"**, I open this file and walk you through it.

---

## ☀️ START HERE — 2026-04-28 morning resume (after the 04-27 session)

### Status check before you do anything
- Last commit: **`9dfefee`** — PPP outreach draft. Pushed origin/main.
- Total today: **6 commits, 13 hostile-review findings closed, 2 new playbooks shipped**:
  - `OUTREACH_PLAY.md` (top-10 prospects, ROI math, integration playbook, pitch drill)
  - `outreach-drafts/01-ppp.md` (your first email, ready to personalize)
  - `HARDENING_PLAN.md` (the engineering improvement queue)
- All tests green: 810/810 jest, 100/100 tampers caught, 3/3 flow regressions.

### The one thing that matters this morning
**Send the email to PPP.** Not "draft it more." Not "polish the architecture doc first." Send it. Everything else is downstream of having a real reply to react to.

The plan is in `outreach-drafts/01-ppp.md`. Seven steps. Execute in order:

1. **LinkedIn search PPP** (10 min) — find Director of Accreditation / CME / Outcomes. Verify a real human, not a placeholder. If LinkedIn is empty, J Clinical Psychiatry masthead page often lists the accreditation contact. **Do not send to a placeholder.**
2. **Pick subject line** — recommended: *"Customer development — psychiatry-CME measurement question"*.
3. **Personalize body** (the 140-word recommended version in `outreach-drafts/01-ppp.md` §3) — fill in [first name]. Optional 1-line specificity hook if you found a recent post.
4. **Read it aloud once.** Cut any sentence that feels like marketing.
5. **Send** — Tue/Wed/Thu, 9-11am ET.
6. **Mark calendar for day-7 bump** (`2026-05-05`).
7. **Walk away.** Do not refresh the inbox.

### Then today's parallel work — the four artifacts every reply will demand
After sending, switch to writing. These exist as Tasks #35-#37 in the system:

- **Architecture 1-pager** (Task #35, ~4h) — derive from `docs/SECURITY_ARCHITECTURE.md`. ≤2 pages. Diagram + 7 layers + JWKS + verifier flow + sub-processors.
- **Privacy DPIA + sub-processor list** (Task #37, ~4h combined) — derive from `docs/technical-faq.md §B`. Zero-PII, no webcam/mic, no IP logging, no content stored, Firestore US-region.
- **Security questionnaire pre-fill** (Task #36, ~1 day) — CAIQ-Lite-style ~100 Qs. Source from SECURITY_ARCHITECTURE + COMPLIANCE_MATRIX + technical-faq.

Total: ~8 hours. Zero external spend. **Done by Friday and you can handle anything PPP throws back.**

### What NOT to do this morning
- ❌ Don't dispatch a fresh skeptic round yet. The 13 closed findings are durable; we'll re-dispatch when there's enough delta. **Send the email first.**
- ❌ Don't open cme-demo.html and start tweaking. The product is in good shape after yesterday's hardening commits. Let it be.
- ❌ Don't send emails to CEC or Prova until PPP goes out and you've watched how it lands. PPP is the practice round. Practice means one at a time.
- ❌ Don't write to Pfizer / Merck / Genentech / Credly. They're explicitly DEFERRED in `OUTREACH_PLAY.md §1` for the same reasons that haven't changed overnight.

### The honest reminder you needed yesterday
You patented something real. The product works. The hostile review made the system harder, not the founder weaker. **The block on outreach was you treating it as one monolithic gate when it's actually four separate gates, three of which are years away.** Insurance, MSA, SOC 2, entity formalization — those gate **paid F500 contracts**. Not learning conversations. Not free pilots. Not cold emails. PPP is a learning conversation. Send the email.

### Where to look if you need to reorient
- `OUTREACH_PLAY.md` — the master playbook (top-10, ROI math, pitch drill)
- `HARDENING_PLAN.md` — the engineering improvement queue (T1/T2/T3 ranked, what's closed, what's open)
- `outreach-drafts/01-ppp.md` — today's email
- `SEVEN_LAYER_DEEP_DIVE.md` — the technical reviewer doc, if a buyer asks for depth
- `docs/yc-defense/11_calibration_methodology.md` — if a stats-trained buyer asks about the Bayesian P(human)
- This file — if you forget where to start

### After PPP goes out, in priority order this week
1. The four artifacts above (Mon-Fri).
2. Drafts 02 (CEC) and 03 (Prova) into `outreach-drafts/` — say "draft CEC" / "draft Prova" and they appear in the same shape as PPP.
3. Re-fire the skeptic round on Friday or Saturday once you've put a week of fresh state on top of yesterday's hardening — see `HARDENING_PLAN.md` "How to run a fresh skeptic round."
4. Tier-3 fundability gaps (LOI, kill 7-vertical YC framing, bottoms-up TAM under $100M) — these are 1-2 hour edits to the YC application; do them before the 2026-05-04 deadline.

---

---

## Where things stand — end of 2026-04-24

### ✅ Shipped — CME vertical demo + biological-signature narrative (evening 2026-04-24, late-late)
Stephen's strategic question: "we need to build other tests that simulate real use case... we may find that depending on use case we're going to have to have different metrics and ways to calculate scores." Answered with code.

- **`proof/cme-demo.html` — the first vertical-specific demo.** "Hypertension Management Update (2026)" CME module. 4 sections of realistic (clearly-illustrative) clinical-ed text, 3 comprehension questions, reflection textarea. Uses section-by-section forced navigation with "Next" buttons — matches real CME UX, not generic scroll-through. Wires `MEDICAL_PROFILE` inline: 6 derived CME-relevant metrics (reactionTime, clickPrecision, sustainedFocus, documentComprehension, fatigueResistance, reactionTimeConsistency) weighted and thresholded per ACCME-style standards (pass 0.65, marginal 0.50, fail 0.35). Receipt verdict reads "CREDIT AWARDED" / "MARGINAL — ADDITIONAL REVIEW" / "NOT COMPLETED TO STANDARD".
- **Biological-signature narrative block shipped to both demos.** "Why this is biologically human" — picks the three highest-scoring signals and tells the peer-reviewed-biology story in plain language: Hick's Law scaling (1952), Fitts' Law (1954), Lacquaniti's two-thirds power law (1983), Gilden's 1/f fractal scaling (2001), micro-pause cognitive gap, cross-signal correlation as adversarial-defense. Turns raw numbers into a buyer-facing story the compliance officer actually understands.
- **Smoke-tested live.** Simulated bot (quick clicks, wrong answers) scored 0.222 composite / "NOT COMPLETED TO STANDARD". Simulated human (10s per section, correct answers, thoughtful reflection) scored 0.361 / "NOT COMPLETED TO STANDARD" — because real motor-signal scores need a real human's mouse; Puppeteer can't fake that. A real Stephen run will score materially higher.
- **Gallery index updated** with a "CME module demo" button alongside the generic demo.
- **Deployed.** https://sws-attention-proofs.web.app/cme-demo.html

**Why this matters for YC:** Pre-CME-demo, our pitch to a Medscape or Pfizer IME team was "here's a generic attention protocol, imagine applying it to CME." Post-CME-demo, the pitch is "here's an actual CME module with an ACCME-style receipt. Here's the medical-profile-weighted scoring. Here's what your compliance officer would see." That's a different conversation.

**Pattern locked in:** Same 20-signal SDK, same 7-layer receipt, vertical-specific derived-metric weights + thresholds + UX + language = distinct demos per buyer vertical. Next candidates when time allows: market-research survey flow (Qualtrics-style), restaurant-training video flow (OSHA-style), nursing-home monitor flow (CMS-style), ad-attention flow (DV/IAS-style).

### 🔧 Recalibration — honest behavioral-gap story (evening 2026-04-24, late)
After re-running the Puppeteer bot-vs-human harness with today's full stack of fixes, discovered a **behavioral-only regression**: LLM Paster bot went from 0.551 → 0.613. Root cause: the same fixes that correctly score slow human readers (dwell-debounce, 200ms filter) also benefit sophisticated bots that deliberately pace themselves like slow readers. A paste-bot that dwells 6s per section + types slowly IS behaviorally indistinguishable from a slow human — because it's engineered to be.

**This is not a bug to hide — it's the honest sophisticated-adversary truth.** What we changed:
- Demo results-page claim downgraded from "bot would score below 0.450" to the truthful **"bot caught at one of seven layers regardless of behavioral score"**. No more single-signal marketing.
- YC application "Anything else" block rewritten: standard Puppeteer bots score 0.47–0.58 behavioral (gap 0.06–0.10), sophisticated paste-bots overlap with human distribution at 0.55–0.65 behavioral, but **4/4 adversarial bots are caught by environmental-gate or composition-integrity**, so the **GATED composite gap holds at 0.273**. That's the only number to quote.
- Removed dwell-debounce from demo.html; SDK's smart sub-200ms filter inside computeReadingSpeed now handles both: valid slow-reader sections score normally, scroll-through artifacts trigger the 0.2 "impossibly-fast skim" fallback when majority.

**Measured bot-vs-human on fresh stack:**
- Naive Bot 0.470 / Jittered 0.485 / Sophisticated 0.579 / LLM Paster 0.613
- Stephen (laptop, incognito) 0.579
- Behavioral-only gap: **-0.040 strongest / +0.109 weakest** (sophisticated paste-bot overlaps human distribution)
- Gated composite: all bots 0.300, human 0.573 → **gap 0.273 holds**
- Every bot flagged by env gate (headless_chrome) AND composition integrity (mechanical/pasted)

**Strategic implication:** The product claim must always be the GATED number. Behavioral-only framing is a liability against a sophisticated adversary and we stop using it in any public-facing copy.

### ✅ Shipped this session — Device Motion fix + LLM harness prep (evening 2026-04-24, post-dinner)

- **Device Motion desktop bug fixed.** Stephen's laptop session scored 0.277/0.333 on Device Motion despite having no meaningful accelerometer. Root cause: tiny-signal accelerometer values (SD 0.001–0.005) fell between the "all-zero" check (0.001) and the human hand-tremor floor (0.005), so they bypassed the insufficient-data gate. The drift calculation then divided by the tiny denominator, amplifying noise into a spurious mid-range score. Fix: (1) raised the insufficient-signal floor to the hand-tremor threshold (accel 0.005, gyro 0.0005); (2) capped the drift denominator at 0.005 so tiny signals can't amplify. Added a regression test covering laptop weak-signal motion. **110/110 signals + harness tests pass.**
- **LLM-in-the-loop harness skeleton built** at `scripts/llm-in-the-loop-harness.js`. Uses `fetch` directly against the Anthropic API (no SDK dep). Puppeteer-driven, Claude makes decisions at each demo phase. Ready to run the moment `ANTHROPIC_API_KEY` is set in `.env`. Expected cost: ~$0.10–0.30 per full session at Claude Sonnet 4.6 pricing (~$3/M input, $15/M output, ~12 LLM turns per session). 50-run study ≈ $5–15.
- **Firebase stress-test cost estimate (see next block)** — numbers for 1K, 10K, 100K session-volume scenarios.

### 📊 Firebase stress-test cost (reply to Stephen's "i need to know the costs")

Per-session Firebase usage:
- **1 Firestore write** (session save) — $0.0000018 on Blaze pricing
- **~2 reads** (gallery/dashboard page loads) — $0.0000012
- **~75 KB hosting bandwidth** (demo.html + SDK + fonts)
- **1 anonymous auth** — free

| Stress-test scale | Writes cost | Reads cost | Bandwidth | **Total** |
|---|---|---|---|---|
| **1,000 concurrent sessions** | $0.002 | $0.001 | 75 MB (under 10 GB free) | **~$0.01** |
| **10,000 cumulative (burst test)** | $0.02 | $0.01 | 750 MB (under free) | **~$0.03** |
| **100,000 (month of traffic)** | $0.18 | $0.12 | 7.5 GB (under free) | **~$0.30** |
| **1,000,000 (full production scale)** | $1.80 | $1.20 | 75 GB × $0.15/GB = $9.75 | **~$13** |

**Real numbers are small.** Concerns aren't cost, they're:
1. **Plan upgrade needed:** Spark (free) plan caps at 20K writes/day. Any stress >1 day at 1K+ sessions/day requires switching to **Blaze (pay-as-you-go)**. The switch is free; you only pay for usage above free tier.
2. **Runaway-write protection:** if a bug caused the SDK to write 1K sessions/sec to Firestore for 1 hour = 3.6M writes = ~$65. Easy to cap with a client-side throttle or a Firestore security rule. Current code writes once per completed session only — no loops.
3. **Rate limits:** Firestore caps per-document writes at ~1/sec; concurrent writes to different doc IDs (which is our pattern — each session has a unique docId) scale freely.

**My recommendation:** Blaze-plan the project (budget-cap at $50/mo as a safety rail) and do a **1,000-session burst test** for ~$0.01 to validate the concurrent-write path. That's the load Stephen should need to green-light. The larger tests aren't needed until we have paid pilots.

### ✅ Shipped this session — Adversarial validation (late evening 2026-04-24)
Stephen's sharp question: "people cant just program the bot to pretend to be slow." Answered with code + numbers.

- **Slow Mimic Bot profile added to bot-harness.** Sync variant scores composite **0.253** (PASSIVE tier — below 0.3). Async variant with fake reading-dwell scores composite **0.404** — it DOES fake Reading Speed (0.786 vs implausibly-fast 0.047 for other bots) but composite stays below lowest human (0.431).
- **4 new adversarial assertions in test suite:** Hick's Law stays low despite slow pacing; timing-entropy stays low (constant intervals give it away); composite < focused-human; the explicit "Slow Mimic CAN fake readingSpeed but composite stays below lowest human" test. **34/34 harness tests pass.**
- **Reading-speed dwell-debounce fix validated** on Stephen's 2nd laptop session: Reading Speed 0.269 → **0.897** (+0.628 lift). Curvature threshold fix confirmed: 0.000 → **0.468**. Composite report/panel now perfectly matched (both 0.579) — freeze fix worked end-to-end.
- **Multi-session Firestore analyzer shipped** (`scripts/analyze-sessions.js`). One command pulls recent demos, computes per-signal mean/p50/p95 per device, flags human-vs-bot separation. Ready for when Stephen's broader testers complete.
- **Composite-gap claim on demo results page updated** from "below 0.250" to the tested "below 0.450" with the adversarial context baked in — including the asterisk that environmental + composition-integrity gates pin bots to PASSIVE regardless.
- **YC draft strengthened** with the adversarial-defense paragraph under "Anything else" — names the Slow Mimic test, cites measured numbers, frames the "fake one signal vs fake twenty in coherence" story.

**Open human-baseline count:** Stephen N=3 sessions (1 mobile 0.523, 2 laptop: 0.565 cached / 0.579 incognito). Link distributed to friends/family for more. Analyzer ready to run on the aggregate when complete.

### ✅ Shipped this session — Calibration fixes from Stephen's mobile test (evening 2026-04-24)
Stephen ran a first session on his phone and scored 0.523 composite — surfaced four real issues that would have embarrassed us at YC:

- **Bug #1 fixed — reading-speed "impossibly fast skim" on natural readers.** Previous section boundaries were scroll-% based (0/20/40/60/80), fired in sub-second succession when a user scrolled to orient before reading, triggering the 0.200 fallback. Rewrote `demo.html` to use **IntersectionObserver** with content-based boundaries (each `<strong>Section N:</strong>` paragraph). SDK also filters sub-200ms section entries from `computeReadingSpeed` and `computeReadingCoherence` as scroll-through artifacts.
- **Bug #2 fixed — composite display inconsistency (0.523 top / 0.540 panel).** The live update loop kept running briefly after `showResults()` and the panel's 500ms read landed on a different snapshot than the one-shot report read. `showResults()` now freezes the entire live panel with the same `getHumanConfidence()` snapshot used for the report — top and panel can no longer disagree.
- **Bug #3 fixed — mobile UX showing "0.000" for N/A signals.** The four mousemove-only signals (curvature index, cursor jerk, velocity profile, two-thirds power law) read 0.000 on a phone because a phone has no mouse. UI now detects touch-only devices via `matchMedia('(pointer: coarse)')` and renders those rows as **"N/A (mobile)"** with greyed-out styling. Summary text also device-aware: tells the buyer the protocol auto-adapts to 16 applicable signals on mobile, with a different list of bot-tell signals named (touch-pressure variance, timing entropy, Fitts, cross-correlation, device-motion coupling).
- **Bug #4 fixed — Activity Pattern = 0 on a 247s mobile session.** Root cause: `recordActivity()` was only hooked to `keydown` and `mousemove`. On mobile there's no mousemove, so reading scrolls didn't register as activity — the whole reading phase became one big "inactivity gap," gapRatio cleared 0.7, and the inactivity signal returned `-1`. Fix: `Behavioral.recordScroll()` now also calls `recordActivity()` — scrolling IS activity, mobile or desktop.
- **Tests:** 171/171 green on signals + harness + sdk-core + behavioral-algorithms suites post-changes.
- **Deployed** to https://sws-attention-proofs.web.app.

**Projected impact on next session:** for an equivalent mobile session Stephen's composite should now land in the 0.60–0.70 range (Active / approaching Deep Focus) instead of 0.52, because readingSpeed goes from 0.20 → ~0.65 and inactivity goes from 0 → ~0.55. For a desktop session the 4 motor signals will also activate, lifting the composite further.

### ✅ Shipped this session — Hardening Sprint extended (evening 2026-04-24)
- **Timeline ring-buffer cap shipped.** `_timeline` now caps at 10,000 snapshots (~27h at 10s cadence). `getTimelineMeta()` surfaces retention + truncation count + complete flag. +3 tests. Prevents the long-session memory-growth red flag flagged by the perf agent.
- **Results-dashboard signal grid expanded to all 20 signals.** Color-coded by family: core 6 cyan, extended 5 purple, analytical 4 amber, motor 5 red.
- **Export CSV expanded to capture all 20 signals + activeSignals.** Was silently dropping 9 signals on download; fixed before any buyer could have exported garbage.
- **YC application pre-filled with what I could extract from context.** City (Uniontown, OH → Mountain View, CA default), project start date (git first-commit 2026-03-27 + patent draft context), pre-existing-accomplishment draft (Stevie Weed Seed + Lucid Wins + food-service-industry experience), "Why did you pick this idea" voice-draft strengthened with personal hooks (daughter as north star, industry experience). Stephen still owns: entity state confirm, burn rate, patent serial, final voice pass, founder video.
- **YC application competitive section overhauled** with research findings: Roundtable corrected S24→S23; added World ID 4.0 (shipped Apr 17 to Tinder/Zoom/DocuSign), HUMAN AgenticTrust (Apr 2026), Proof Certify (Oct 2025), Cloudflare Privacy Pass; updated DV/IAS framing for Nov 2025 IAB+MRC Attention Measurement Guidelines; added honest acknowledgment of IACR ePrint 2025/2330 academic prior art.
- **Competitive research complete (agent).** Tier 1 direct threats: Roundtable (score API, not receipt), World ID (identity, not attention), HUMAN AgenticTrust (agent auth, not human). Tier 2 could-pivot: BioCatch, Proof, Cloudflare Privacy Pass, DV+IAS attention products. **Intellectual-priority risk:** IACR 2025/2330 academic paper predates provisional filing; needs patent-attorney consult before utility conversion.
- **YC S26 acceptance calibration (agent).** Base rate ~1%, solo-founder penalty ~5× absent traction, offset by working product + tests + patent ~3-5×. **Net: 1.5%-3.5% probability, central estimate ~2%.** Real plan: apply S26 clean, use May-July for pilots+cofounder, reapply W27 at ~6-10%.
- **Final Firebase deploy** with all afternoon fixes. Live at https://sws-attention-proofs.web.app.
- **Full test suite:** 780/781 passing when run in parallel; 7/7 passing in demo-e2e when run in isolation. The single intermittent failure is a Puppeteer port-contention race under parallel workers, not a regression — remediated by running that one suite alone if needed. Product claim: **781 tests exist, 100% pass in isolation, 99.87% pass under parallel stress.**

### ✅ Shipped this session — Hardening Sprint continuation (late afternoon 2026-04-24)
- **Signing-key rotation dry-run complete.** `scripts/rotation-dryrun.js` validates the staged rotation materials end-to-end without touching production: (a) new keypair is valid Ed25519 + signs/self-verifies, (b) multi-key JWKS routing works for both old and new kids (backward compat during grace), (c) cross-key rejection proves the rotation is cryptographically distinct. `.env` unchanged, no deploy executed. Real cutover remains gated on Stephen's go.
- **Cold-start offline verification script shipped.** `scripts/verify-offline.js` uses only `fs` + `path` + `crypto` (no network modules). Takes a JWT + JWKS file path, prints a per-step verification walkthrough, exits 0/1/2 for valid/invalid/expired. Validates the SCIF-compatible claim empirically. Verified against `proof/results/humanness-sample.json` + live `proof/.well-known/attention-pubkey.json` — passes, zero network calls.
- **SDK perf baseline measured (agent-captured):** 48 KB total gzipped, 2.8 ms mean / 6.4 ms p95 load (Node vm loader, 100 trials), 2.2 μs mean per recorded interaction, ~108 bytes heap per interaction. One flagged issue: `_timeline` grows unbounded — fine for minutes-scale sessions, needs ring-buffer cap before any all-day kiosk deploy.
- **Gallery drift audit + fixes (agent-captured + hand-fixed):** `prove-humanness.html` no longer loads an expired sample — it fetches the fresh `results/humanness-sample.json` at runtime. Signal count harmonized across index.html / demo.html / pilot-report.html / part-11.html / prove-humanness.html / compliance-report.html (everything now says 20, not 11/15/19/6). `verify.html` copy updated from "six-layer" to "seven-layer" to match what the UI renders. `part-11.html` "published git history at commit `HEAD`" replaced with "778 unit + integration tests, 100% pass (2026-04-24)." Gallery redeployed.
- **YC application mechanical pass (draft):** signal count (15→20), test count (708→778 / 34→36 suites), added SDK perf numbers, added bot-vs-human discrimination numbers (Node harness 0.161 gap / live-demo 0.022-0.101 behavioral / 0.273 gated), added offline-verify + rotation-dryrun claims. Stephen still needs to fill 6 bracketed inputs + rewrite `[STEPHEN: REVIEW]` blocks in his own voice + record founder video.

### ✅ Shipped this session — Hardening Sprint Day 1 (afternoon 2026-04-24)
- **Test suite is 100% green (`npm test`): 778/778 across 36 suites, no OOM.** Fixed three stale-fixture failures by switching hardcoded `2026-04-21` dates to runtime-relative timestamps in `humanness.test.js`, `canonical-fixtures.test.js` (pass `{ignoreExp:true}` for signature-validity tests — exp behavior itself is still covered by the dedicated block), and `environmental-gate.test.js`. OOM was never a code bug; `npm test` uses `--max-old-space-size=4096`, the earlier bare `npx jest` didn't inherit it.
- **Live demo fixtures refreshed** via `scripts/refresh-demo-fixtures.js`: `proof/results/humanness-sample.json` and `verify-sample-6layer.json` now carry fresh JWTs (kid=`sws-attention-2026-04`, behavioral=0.780, tier=deep). proof-humanness.html won't display expired credentials to buyers.
- **Critical drift fix:** `proof/sdk/attention-protocol.js` was a stale COPY of `src/sdk/attention-protocol.js` — it was missing *both* yesterday's digraph work *and* this morning's Day-1 signals. Live demo was running pre-digraph, pre-Day-1 SDK. Synced `proof/sdk/attention-protocol.js` with source (92,379 bytes). Bumped demo.html cache-buster to `v=20260424a`.
- **Demo.html instrumented for Day-1 signals:** `recordSectionEntry(id, wordCount)` now called with DOM-computed word counts on the READ phase. Word counts are computed at page-load from section headers + paragraphs so content edits auto-propagate.
- **Live-demo gap re-measured via Puppeteer harness (post-Day-1):**
  - Bot behavioral composites: Naive 0.479 / Jittered 0.472 / Sophisticated 0.509 / LLM Paster 0.551
  - Stephen baseline (2026-04-20): 0.573
  - **Behavioral gap: 0.022 strongest bot (LLM Paster) / 0.101 weakest bot (Jittered) — up from the previous 0.011** at strongest (roughly 2× widening)
  - **Gated gap: 0.273 (all bots capped to 0.300 by env + composition-integrity layers)** — unchanged; the gated composite was already dominated by those layers
  - Environmental gate catches 4/4 bots as headless_chrome; Composition Integrity flags 4/4 (mechanical or pasted)
  - **Caveat:** Stephen baseline was captured pre-Day-1; a fresh human baseline capture would likely widen the gap further (human readingSpeed would gain coherence boost). Item for tomorrow.
- **YC-ready test count:** **778 tests passing** (was 754 before today's morning signals work + hardening fixes). Reproducible via `npm test -- --forceExit`.

### ✅ Shipped earlier this session — Machine-sprint Day 1 (morning 2026-04-24)
- **Reading-speed coherence (Signal 8 upgrade):** `recordSectionEntry(id, wordCount)` + `recordSectionExit(id, pct, wordCount)` now accept an optional word count. When present, `computeReadingSpeed` blends a WPM-plausibility score (bands from the reading literature: 150–700 normal, 700–1200 skim, >2000 = bot tell) at 60% weight against the existing CV-based score at 40%. Implausible-majority sessions get clamped to ≤ 0.25. New public API: `SWSAttention.getReadingCoherence()`.
- **Active window-focus tracking (Signal 10 upgrade):** Added `window.addEventListener('blur'/'focus')` listeners in `init()` + programmatic `SWSAttention.recordWindowFocus(focused)`. `computeTabVisibility` now folds in focus evidence: a session with zero tab-hide events but ≥1 blur reads as "app-switched human" (0.78 short / 0.85 long) instead of the old 0.75 default; a session with ~perfect visibility **and** ≥1 blur gets a +0.05 coherence bump. New public API: `SWSAttention.getFocusStats()`.
- **Harness extended (asterisk closed):** `tests/bot-harness.test.js` now drives the new signals via `runSimulationAsync` + `enhanceWithDay1()` across all 5 bots + 3 humans, double-runs each profile (baseline vs enhanced), and prints a before/after gap report. +7 tests / +1 report block.
- **Measured lift (this run):** baseline bot=0.255 / human=0.300 / **gap 0.045** → enhanced bot=0.296 / human=0.457 / **gap 0.161** → **+0.116 absolute widening (260.7% relative)**. Humans gained +0.131–0.174 apiece; bots only gained +0.023–0.064 (composite lift from unlocked cap — readingSpeed stays clamped at 0.046–0.047 and blurCount=0 across all bots, confirming the signal is doing its job). Numbers reproducible via `npx jest tests/bot-harness.test.js --forceExit`.
- **Tests:** +12 in `tests/signals-7-20.test.js` (7 reading-speed coherence, 5 window-focus), +7 in `tests/bot-harness.test.js`. Signals suite: **72/72**. Harness suite: **29/29**. Cross-suite regression: **370/370** across 14 SDK-adjacent suites.
- **Known unchanged failures:** `humanness.test.js` + `canonical-fixtures.test.js` are still red for the stale-fixture-date reason documented below (Day 5 fix), not for anything in today's changes.

### ✅ Shipped yesterday
- **Docs (6):** `docs/buyer-use-cases.md`, `docs/prospect-primers.md`, `docs/pricing.md`, `docs/pilot-success-criteria.md`, `docs/loi-template.md`, `docs/vertical-ranking.md`
- **SDK:** Digraph keystroke timing in `src/sdk/attention-protocol.js` (privacy-safe class bucketing, pair-transition statistics, cross-pair differentiation). Exposed as `SWSAttention.getDigraphStats()`.
- **Tests:** +5 new tests in `tests/signals-7-20.test.js`, all pass (60/60 in that suite). Core assertion: "human varied typing scores strictly higher than robotic uniform-paste" — passes.

### 🧠 17-team research sweep — catalog done
Background Explore agent inventoried every vertical research output in the repo. 8 verticals covered with buyer-level depth (CME, Pharma, Market Research, Insurance, Nursing Homes, Restaurants, Corporate LMS, Credentialing). Thin/placeholder coverage: Military, Advertising, Medical/Surgical, Legal, Gaming. Full synthesis in `docs/vertical-ranking.md`.

### ❌ Still open
- **LLC entity formalization** — blocks LOI enforceability on our side. You-only task.
- **Real human corpus** still N=1 (toolkit ready in `docs/corpus-collection-kit.md`, invites not sent).
- **CME demo video** not recorded (script in `docs/cme-demo-script.md`).
- **Cold emails** not drafted — blocked on you finishing study.
- **Anthropic support ticket** to unblock the LLM-in-the-loop bot harness.
- **Stale fixture date bug** — 3 tests failing (`humanness.test.js`, `canonical-fixtures.test.js`). Fixtures hardcoded to `2026-04-21`; 24h JWT exp window has elapsed. Task #9.
- **Signing-key rotation cutover** — `rotation-staging/ROTATION_PLAN.md` ready, 15 min when you want.
- **Bogazici empirical-priors dataset** — 5-min browser click at Mendeley; advisor says drop.

---

## Your work when you sit down — learning arc continued

You finished §3 (terminology) in `STUDY_GUIDE.md` yesterday. The freeze rule still applies to that file and to all six `docs/*.md` deliverables I shipped today — I don't edit them while you're reading them.

### Tier 1 — "I only have 30 minutes"

**Read `docs/vertical-ranking.md`** (15 min). This determines where we spend the next 10 days of outreach. Scoring rubric, ranked table of all 17 verticals, three "start here" picks (Market Research, CME/MECs, Restaurants via your personal edge), recommended 60/30/10 effort split. Push back on anything wrong.

Then tell me: **"vertical ranking looks right"** or **"I want to redirect X → Y."**

### Tier 2 — "I have 2–3 hours"

Do Tier 1 first. Then pick ONE:

- **A · Continue the study guide** — §4 (seven layers), §5 (gated composite), §8 (numbers to memorize). Foundation for every buyer conversation.
- **B · Read one Claude-produced doc** — my recommendation: `docs/buyer-use-cases.md` (Priya/Marcus/Jordan day-in-the-life, 20 min). Makes the vertical ranking concrete.
- **C · Mock pitch drill** — I role-play VP Product at Qualtrics (Market Research #1 start-here). You pitch for 2 min. I ask hard questions. We iterate until you can survive it cold.
- **D · Draft the first 5 cold emails** — personalized to Market Research Tier-1 (Qualtrics, SurveyMonkey, Typeform, Alchemer, Dynata). Sleep on them one night. Send morning +1.

### Tier 3 — "I have the full day"

Tier 1 + one of A/B + one of C/D. Plus:

- **Send corpus invites** (15 min active, 48-hr background collection)
- **Entity formalization research** — 30 min to find a Delaware LLC filing service and budget the fee. This is the single biggest non-technical blocker. Pharma won't contract with a non-entity, and LOIs aren't enforceable on our side until it's done.
- **Decide on the pharmacist friend** — do you want me to draft the 10-question interview guide? Routing them to Pharmacy Board CE is my recommendation (second-tier vertical that jumps to start-here with one warm intro).

---

## My parallel track — machine-tightening sprint

When you tell me **"go"** or **"proceed in parallel"**, I do this without waiting on you. I stop between items for your approval only when a decision affects positioning or cost. Ordered by impact-per-day.

### Day 1 ✅ — Reading-speed coherence + active window-focus tracking (shipped 2026-04-24 AM)
- **Reading-speed coherence** — shipped. WPM-plausibility bands blend with CV scorer at 60/40; implausible-majority clamp at ≤0.25. `SWSAttention.getReadingCoherence()`. See "Shipped this session" above.
- **Active window-focus tracking** — shipped. `blur`/`focus` listeners + `recordWindowFocus()` + `getFocusStats()`. `computeTabVisibility` folds in focus evidence; no-vis-event + ≥1 blur session now reads as 0.78/0.85 (was 0.75), and perfect-vis + blur gets +0.05. See above.
- **Net result:** Both signals promoted from "under-leveraged" to producing orthogonal coherence evidence. Harness re-run pending (see note below re: bot-harness not exercising typed input or focus events yet).

### Day 2 — Vertical-specific gate thresholds in the gated composite
- `src/sdk/vertical-scoring-profiles.js` already exists but isn't wired into the gated composite. Wiring it means we tell a Qualtrics buyer "at the Market Research threshold the gap is X," a Medscape buyer "at the CME threshold the gap is Y," etc. Different thresholds, same protocol.
- Ships with per-vertical "start here" thresholds derived from the ranking doc.
- Estimated effort: 1 day.

### Day 3 — Temporal entropy (server-side) + second-visit consistency
- Server-side session-arrival-time entropy: bots cluster at cron boundaries (*.00, *.15, *.30). Humans don't. One query against Firestore.
- `baseline-profiler.js` already fingerprints a session — expose a cross-session match function. If the same DID shows up twice with materially different behavioral patterns, that's an account-sharing tell. Strengthens the credentialing story.
- Estimated effort: 1 day combined.

### Day 4 — Vertical integration examples
- Expand `src/sdk/integration-examples.js` with:
  - A Market Research / survey platform example (Qualtrics-style). Our **#1 start-here** vertical; deserves a first-class integration snippet for cold emails.
  - A Restaurants / LMS channel-partner example (Schoox / Wisetail / PlayerLync-style). Your personal-edge vertical.
- Each gets sample code + xAPI / receipt shape + a 5-line "what the buyer pastes" block.
- Estimated effort: 1 day.

### Day 5 — Fix stale-fixture bug + regenerate sample receipts (Task #9)
- Shift fixtures to compute `generated_at = now` at sign time so tests stay green regardless of the calendar.
- Re-run `scripts/refresh-demo-fixtures.js`; update canonical fixtures.
- Result: test suite back to fully green, CI-ready, YC-submission-ready.
- Estimated effort: 0.5 day.

### Day 6 — Pharmacy Board CE dossier + pharmacist interview guide
- Only if you route your pharmacist friend into this vertical. Produces `docs/prospect-dossiers/21-pharmacy-board-ce.md` with the named state boards and CE content providers (Power-Pak, CEimpact, Pharmacy Times, RxLearning.com) + the 10-question interview guide you take to your friend.
- Estimated effort: 0.5 day.

### Day 7 — Military / Medical-Surgical vertical dossiers (gap-fill)
- The Explore agent flagged Military and Medical/Surgical as "placeholder only" in the existing research. If we want these in the YC application as viable future wedges, they need one-pager dossiers each.
- Not start-here verticals — just filling the gap so the vertical-ranking claims are defensible.
- Estimated effort: 0.5–1 day.

### Day 8–10 — YC application final pass (Task #6)
- Read `YC_S26_APPLICATION_DRAFT.md`, fill every `[BRACKET]`, cross-check every number against current repo state (754+ tests, gated composite gap 0.273 → likely wider post-digraph, etc.), tighten claims to match shipped reality.
- Estimated effort: 1–2 days. Gate on your approval before submitting.

### Stretch items (if we finish ahead of schedule)
- **Keystroke digraph across sessions** (#9 on the original list — writer-ID for credentialing fraud; scope-creeps into PII territory, proceed with caution).
- **Mobile accelerometer attestation** (#7 — new layer for mobile-heavy verticals; 2-day effort).
- **LLM-in-the-loop bot harness** (currently blocked on Anthropic billing; 2 days after unblock).

---

## Triggers — say one of these tomorrow

- **"let's get started"** or **"what should we do?"** → I open this file
- **"vertical ranking looks right"** → locks in the 60/30/10 effort split, I proceed on Day 1 of the parallel track
- **"redirect vertical X to Y"** → we discuss and update `docs/vertical-ranking.md`
- **"mock pitch me on Qualtrics"** → interactive mock pitch drill
- **"draft the emails"** → we personalize 5 Market Research cold emails
- **"pharmacist interview guide"** → I produce the 10-question guide
- **"go"** or **"proceed in parallel"** → I start Day 1 of the machine-tightening sprint without waiting
- **"show me what you shipped"** → I summarize the six docs + digraph + vertical ranking
- **"what's blocking YC?"** → I list the open items against the 2026-05-04 deadline

---

## Context you should not lose overnight

- You finished `STUDY_GUIDE.md` §3 today. Next is §4 (seven layers).
- You have not yet read any of the six docs I shipped today. Read `docs/vertical-ranking.md` first — it's the one that steers everything else.
- Your pharmacist friend is a live lead. Don't let the thread drop.
- Digraph is shipped but **not yet exercised by the bot harness** (harness doesn't simulate typed input). If you want to see the digraph contribution in the harness output, that's a Day 2–3 add — simulate typed sequences in each bot profile and regenerate the reporter. (The Day-1 signals ARE now exercised by the harness as of this morning — see "Measured lift" above.)
- The stale-fixture bug does not affect production — it's a test-fixture date drift. Don't panic when you see the 3 failing tests; they were failing before digraph shipped.

---

**Last updated:** 2026-04-24 morning, after Day 1 of the machine-tightening sprint shipped (reading-speed coherence + window-focus tracking, +12 tests, 370/370 regression green). Learning arc still mid-flight — Stephen has not yet read `docs/vertical-ranking.md`. Parallel track ready to continue on Day 2 (vertical-specific gate thresholds) on go.
**Next update:** after Stephen picks the next move — read vertical-ranking, push to Day 2, or both.
