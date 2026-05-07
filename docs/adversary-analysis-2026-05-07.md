# Adversary Analysis — 2026-05-07

**Author:** Stephen Furpahs, SWS Strategic Media LLC
**Audience:** Founder, pilot prospects, prospective auditors, future academic reviewers
**Status:** Snapshot of current adversarial coverage + identified gaps as of 2026-05-07

A defense system is only as strong as the threat model it's been measured against. This document maps the SWS Attention Protocol's coverage today, names every adversary class we've explicitly tested (with measured numbers), and is honest about the classes we haven't.

---

## 1. Defense layers in play (recap)

The protocol stacks defenses so that no single signal carries the load:

| Layer | What it does | Source of truth | Bypass cost |
|---|---|---|---|
| **Environmental gate** | Detects headless browsers (Puppeteer / Selenium / Playwright) by UA, automation flags, navigator.webdriver, plugins, `chrome.runtime`, etc. | Client + server | Low ($0 — non-headless browser) |
| **Composition integrity** | Detects mechanical paste, instant text appearance, copy-without-keystrokes | Client + server | Low ($0 — type instead of paste) |
| **23 behavioral signals** | Pacing, dwell, scroll, keystroke timing, motor stats (curvature, jerk, two-thirds power), Fitts, Hicks, etc. | Client → composite | Medium ($50–500 — bot-development hours) |
| **THE WALL — server-side composite recompute (R2-NEW-2)** | Server independently recomputes composite from raw event log, rejects on >0.05 divergence from client-claimed score | Server | High ($5k–20k — must reverse-engineer + replicate scoring) |
| **THE WALL — trace-novelty fingerprint (R2-NEW-2b)** | Bucket-hashes session trajectory; flags when a fingerprint reappears across different uids | Server (Firestore admin-only) | High — must produce novel session per attempt |
| **Cryptographic receipt** | Ed25519 signed JWT, OpenTimestamps Bitcoin anchor, JWK published | Server | N/A — defense in different sense (audit trail) |

Bypass cost shifted from ~$50/mo + 56h pre-Wall to **$5–20k/mo + 200–400h** post-Wall (Round 5 documented finding).

## 2. Adversary classes — measured today

Bot harness at `tests/bot-harness.test.js` (34/34 tests passing, run 2026-05-07). Behavioral-only composite, no Wall. Numbers below are **what the bot scores in the composite calculation** before any server-side gate runs.

| Adversary | Description | Composite | Caught by |
|---|---|---|---|
| **Naive Bot** | Vanilla Puppeteer, no behavioral mimicry | 0.281 | Environmental gate (headless) + composite below threshold |
| **Jittered Bot** | Random delays added to mouse/click | 0.292 | Same |
| **Selenium Bot** | Selenium-driven, marked automation flags | 0.331 | Same |
| **Click Farm** | Very low engagement, instant clicks | 0.212 | Composite below threshold (no env gate needed) |
| **Replay Attack** | Replay of recorded session | 0.364 | Trace-novelty fingerprint (Wall) |
| **Slow Mimic** | Paste-with-fake-dwell, longest-running threat | 0.404 | Composition integrity (paste detection) — composite barely below human floor of 0.431 |
| **Focused Reader** (human) | Real engaged user | 0.474 | (passes — control) |
| **Casual Browser** (human) | Real distracted user | 0.465 | (passes — control) |
| **Distracted User** (human) | Real multitasking user | 0.431 | (passes — control) |

**The 0.027 margin between Slow Mimic (0.404) and Distracted User (0.431) is the smallest gap in the system.** This is why we ship layered defense — the gap on composite alone is uncomfortable. With env gate + composition integrity + Wall recompute, all six bots get capped to PASSIVE tier (≤0.300) regardless of what their behavioral composite reads.

**Production stress test (2026-05-07 17:21 UTC):** 50/50 sessions across 5 device classes signed cleanly, JWTs verify against live JWKS, 100% production receipt-issuance rate.

## 3. Adversary classes — known but not yet measured

These are real 2026 threats that the current bot harness does not cover. Listed in priority order of "how likely we'll see this in a CME pilot."

### 3a. LLM-in-the-loop bot (highest priority)

**Description:** Claude or GPT-4 driving a real browser via Puppeteer. The LLM reads the activity content, makes plausible decisions about pacing, scrolls naturally, types responses based on the content. Most modern fraud automation in 2026 uses this pattern.

**Why we haven't measured it:** Script exists at `scripts/llm-in-the-loop-harness.js` but blocked on running it (cost: ~$0.10–0.30 per session, ~$5–15 for a 50-session study).

**Expected outcome based on theory:** LLM-driven sessions should behaviorally cluster between Slow Mimic (0.404) and human floor (0.431) — the LLM can fake reading-speed plausibility but inherits the bot's mechanical motor signatures (curvature index, cursor jerk, two-thirds power law). The Wall's server-side recompute should still catch it. Measured numbers are needed before we ship a "we catch LLMs" claim.

**Status:** Queued. Authorized run = $5–15 from the existing API key. Highest-leverage adversarial test we can run today.

### 3b. Recorded-and-replayed real human session

**Description:** Capture a real human's full event log (mouse traces, keystrokes, scrolls, timing) and replay it byte-for-byte against multiple accounts. Bypasses every behavioral signal because the data IS human data.

**Defense:** Trace-novelty fingerprint (R2-NEW-2b). The fingerprint bucket-hashes session trajectory at trust-relevant resolution; the same trajectory across different uids triggers rejection.

**Status:** Defense is shipped. Empirical test of the defense at scale is queued — needs a synthetic test that records one session and replays N times, measures rejection rate.

### 3c. Coordinated multi-account fingerprint reuse

**Description:** Variant of 3b — use the same recorded trace across 100 fake accounts to scale credit awarding. Operationally cheaper than producing 100 distinct human sessions.

**Defense:** Same as 3b. Trace-novelty catches the duplicated fingerprint.

**Status:** Same as 3b — defense shipped, empirical scale test queued.

### 3d. Browser-extension / real-browser injection

**Description:** Real Chrome/Firefox installation with an extension that injects synthesized mouse/keyboard events. Bypasses the headless-detection environmental gate because the browser is real.

**Defense partially exists:** Composition integrity catches paste-style injection. But event-injection at the OS level (e.g., AutoHotkey, xdotool) might bypass paste detection while still producing mechanical signatures.

**Status:** **Not currently tested in the harness.** The Puppeteer-based test framework can't easily simulate this. Would need a real-browser-with-extension test rig, which is more complex.

### 3e. Generative behavioral synthesis

**Description:** Train a small ML model on real human session data, generate synthetic sessions that statistically match the human distribution. Emerging research-level threat.

**Defense:** Multi-signal coherence (signals correlate in human-specific ways that a single-signal-trained generator misses). The Wall's recompute also helps.

**Status:** Not currently tested. Threat is real but expensive enough that it's unlikely to appear in a CME pilot environment in 2026. Worth keeping on the watch list.

### 3f. Proxy completion (real human, wrong identity)

**Description:** A med student, NP, or relative completes the CME activity on the physician's behalf. The session is real human engagement — but by the wrong person.

**Defense:** **The protocol does not authenticate identity.** It attests engagement quality. This is an HONEST GAP that must be communicated to every CME buyer.

**The locked answer for buyer calls:**

> *"We don't authenticate identity — we attest engagement. Identity is a separate layer (board ID + biometric + known-device match + session continuity) that you'd add on top. Our receipt confirms 'a real human paid attention to this content for this duration with these signals.' If you want it to also confirm 'and that human was Dr. Specific Person,' you bind our receipt to your existing identity stack — typically a logged-in board-credentialed account."*

**Status:** Acknowledged gap, communicated, not the protocol's job. CME providers already solve identity through their existing credentialing stack.

### 3g. Distracted-physician multitasking (the legitimate edge case)

**Description:** A real, identified physician completes a CME activity while distracted (phone, email, kids interrupting). Signals are real-human but at the low end of the distribution.

**Defense:** This is **not an adversary** — this is a legitimate user. The 5th-percentile threshold and the appeal queue (per the threshold-derivation methodology) handle it. A small minority of distracted-but-real sessions land in the appeal queue and get manually reviewed.

**Status:** Working as designed. The methodology doc explicitly addresses this case.

## 4. CME-specific adversary scenarios

In the CME context specifically, the adversaries map onto the seven-layer defense as follows.

| CME-realistic adversary | Closest harness profile | Caught by |
|---|---|---|
| Physician ChatGPT-ing a post-test | LLM-in-the-loop (3a) | Wall recompute + composite below human floor |
| Click-through completion | Click Farm | Composite + duration floor |
| Bot farm doing 10,000 fake completions | Naive / Jittered Bot | Environmental gate + composition integrity + Wall |
| Recorded-replay of one good session | Replay Attack (3b) | Trace-novelty fingerprint |
| Med student completing on physician's behalf | (Proxy — 3f, not addressed by protocol) | Identity layer outside protocol |
| Group viewing where one clicks for many | (Proxy — variant of 3f) | Identity layer + per-account session uniqueness |
| Distracted physician multitasking | Distracted User (legitimate) | Threshold appeal queue |
| Scripted browser automation with paste | Slow Mimic | Composition integrity (paste flag) |

**The five adversaries unique to CME that are not generic-SaaS adversaries:**

1. **Physician-using-ChatGPT** is the *political* adversary that ACCME's December 2025 AI guidance is responding to. This is the threat that's driving market demand right now. It's covered by Wall + composite + duration floor — and the LLM-in-the-loop test will give us a measured number.
2. **Group viewing** is a long-standing CME issue (a senior partner watches with junior staff; only the senior gets credit). This is fundamentally an identity problem, not a behavioral one. The protocol lays cleanly on top of identity solutions but doesn't solve identity itself.
3. **The "10,000 fake completions" bot farm** has been seen at scale in adjacent industries (online education, ad-fraud) but is rarer in CME because the per-credit value is too low to amortize industrial fraud setup. Still, layered defense catches it cleanly when it happens.
4. **Recorded-replay** of a "known good" session shared between physicians as a "shortcut." Trace-novelty catches this; we should empirically test it before quoting the catch rate.
5. **Distracted-physician** is a real-human edge case, not an adversary. The threshold methodology addresses it via appeal queue, which CME providers already operate.

## 5. Defense gaps that need work

In priority order — what to ship next to close known gaps.

### Gap 1 — LLM-in-the-loop measured number

**What:** Run `scripts/llm-in-the-loop-harness.js` for 20–50 sessions across 3 attack patterns (Claude completes activity normally; Claude rushes through; Claude pastes from another session).

**Cost:** ~$5–15 in Anthropic API calls.

**Output:** Three measured composite-score distributions for LLM-driven sessions, integrated into the bot harness. Lets us quote "we tested LLM-driven adversaries; they cluster at composite X and are caught by Wall layer Y" instead of "we believe LLMs would be caught."

### Gap 2 — Recorded-replay empirical test

**What:** Capture one real human session via the demo. Replay the event log against 50 different synthetic uids through the Firestore trigger. Measure how many get rejected by trace-novelty fingerprint.

**Cost:** $0 (one human's time + scripted replay).

**Output:** Empirical rejection rate for replay attacks at the Wall's trace-novelty layer.

### Gap 3 — Better signing-error logging

**What:** Replace the generic `signing_error: 'signing_failed'` Firestore write with a structured `{ class: 'bad_signing_key' | 'sanitize_failed' | 'sign_threw', detail: <redacted>, at: <timestamp> }` so future outages are diagnosable from Firestore alone. Shipped in 5 minutes.

**Cost:** $0.

**Output:** Round-8 alarms can be wired against `signing_error.class` rather than waiting for someone to read Functions logs.

### Gap 4 — Production-wire smoke test (Round 8 pattern)

**What:** Add a scheduled Cloud Function or external monitor that runs a synthetic-session-and-verify test every 6 hours. Alerts on any failure. Closes the "10-day silent outage" failure mode.

**Cost:** ~$0.01/month on Firebase.

**Output:** No silent outages possible — any signing failure triggers an alert within 6 hours of first occurrence.

### Gap 5 — Browser-extension test rig

**What:** A separate test harness using real Chromium with a synthetic-input extension. Tests whether OS-level event injection bypasses the environmental gate and composition integrity layers.

**Cost:** 2–4 hours of harness-building.

**Output:** Measured numbers on whether real-browser-with-injection can score above human floor. Closes a known gap in the threat-model coverage.

## 6. What we can claim today (post 2026-05-07 work)

**Cryptographic correctness** — receipts verify offline against the published JWK with no vendor in the loop. Verified end-to-end against 50 synthetic sessions on 2026-05-07.

**Behavioral robustness** — six bot profiles measured, all score below the lowest human profile. Smallest margin (0.027) is uncomfortable on composite alone; layered defenses (env gate + composition integrity + Wall) cap all bots to PASSIVE tier independent of the composite gap.

**Production reliability** — 50/50 sessions signed and verifiable post-fix. Receipt-failure rate on this sample: 0%. Forward target: <1% under real production conditions, to be measured per-deployer.

**Hardening posture** — 7 rounds of hostile adversarial review with ~85 findings closed. Round 8 (production wire smoke + LLM-in-the-loop measurement) is the natural next phase.

**Documented blind spots** — proxy completion (intentional gap; identity is a separate layer), browser-extension event injection (testable but not yet tested), generative behavioral synthesis (research-level threat).

## 7. What we cannot claim today

- "We catch all bots." We don't. We catch every class we've measured, but new classes are always developed. The only honest posture is "we measure transparently, publish methodology, hostile-review continuously, and the layered architecture means no single bypass collapses the whole system."
- "We catch LLM-driven completions." Theoretically yes, empirically not yet measured. **Until the LLM-in-the-loop harness runs, this claim is off-limits.**
- "Our threshold catches >X% of bots." Threshold is population-relative per the methodology doc; the deployer derives their threshold. Vendor-wide claims are wrong.
- "We're SOC 2 / ISO 27001 / cryptographically audited by a Tier-1 firm." Not yet. Pathways exist; sequencing is in `cme-vertical-use-cases.md` §expansion-path.

## 8. Honest framing for buyer calls

If a sophisticated buyer asks *"what bots have you tested against, and how do I know the system holds against the bots I haven't told you about?"*:

> *"Six classes measured today, with composite numbers in the harness output. The strongest behavioral-only attack lands at 0.404; the lowest legitimate human in our test set lands at 0.431. We're honest that's a tight gap on composite alone — that's why we ship layered defense: an environmental gate above the composite, a composition-integrity check beside it, and a server-side recompute and trace-novelty fingerprint above both. Bypass cost moved from $50/month to $5–20k/month after the Wall shipped. The classes I haven't yet measured — LLM-in-the-loop, browser-extension injection, generative synthesis — are listed transparently in our adversary doc with the proposed test methodology and ETA. I'd rather show you the gaps than pretend they don't exist."*

That answer wins. Bluffing here loses on the next question.

---

**Status:** Version 1.0, released 2026-05-07. Next update after LLM-in-the-loop harness runs (Gap 1) and recorded-replay test ships (Gap 2).
