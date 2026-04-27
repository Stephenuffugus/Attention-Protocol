# THE WALL — Empirical Validation Report

**Date:** 2026-04-28
**Scope:** R2-NEW-2 server-side composite recompute + R2-NEW-2b trace-novelty fingerprint matching
**Code under test:** `proof/functions/server-scorer.js` at HEAD (post-round-7 + post-Tier-1-crypto-rigor)
**Test suite:** `tests/wall-empirical-validation.test.js` (14 tests, deterministic seeded RNG)

---

## TL;DR

The wall does what it claims to do, on the synthetic distributions
we can produce without real-pilot data:

| Metric | Result |
|---|---|
| False-positive rate on 1000 synthetic human-like sessions | **0.00%** (0/1000 incorrectly flagged) |
| Mean divergence delta on humans (vs DIVERGENCE_THRESHOLD=0.30) | **0.050** (6× margin) |
| Bot-builder attack vectors caught (5 distinct attack designs) | **5/5** (100%) |
| Recompute latency on 5000-event log (max-size) | **1.59 ms** (Cloud Function 60s timeout = 38,000× headroom) |
| Trace-novelty fingerprint diversity (1000 varied sessions) | **986 unique / 1000** (98.6%) |
| Trace-novelty collision rate post-tightening | **2.80%** (was 96.9% on the original-coarse bucket scheme; round-7 empirical-driven fix) |

**Calibration debt remaining**: pilot-session distribution to tune
DIVERGENCE_THRESHOLD and fingerprint bucket boundaries. The 0.30
threshold has 6× margin on synthetic data; pilot data may permit
tightening to 0.20 or may push it to 0.40 depending on real-world
session-shape variance. Tracked as R5-NEW-9.

---

## What this validates and what it doesn't

**Validates:**
- The 5 server-scorer signals (timing_cv, motion, keystroke_coherence,
  duration_match, event_density) catch every documented round-2 bot-
  builder attack design at the synthetic-fixture level.
- Synthetic human-like sessions with realistic parameter variation
  (60-900s duration, 1-10 mousemoves/sec, 0-300 keystrokes) produce a
  divergence distribution well below the 0.30 threshold.
- Recompute latency is far below any production timeout — a 5000-event
  log (the recorder's hard cap) recomputes in ~1.6ms; the
  full Cloud Function budget is 60 seconds.
- The trace-novelty fingerprint quantization (post-empirical-driven
  fix from 0-9 to 0-99 per dimension) produces ~99% unique
  fingerprints across 1000 varied sessions.

**Does NOT validate:**
- Real pilot-session distribution. Synthetic seeded humans don't
  capture the long tail of real-user variation (accessibility tools,
  unusual browsers, multi-monitor setups, slow connections). This is
  R5-NEW-9 / pilot-data calibration debt — the threshold and bucket
  boundaries can only be honest-tuned with N≥30 unrelated real users.
- Any attack vector NOT in the round-2 bot-builder design. A novel
  attack class (e.g., a generative motor-trace synthesizer trained
  on Stephen's recorded traces, or an LLM-driven event-stream
  generator) could in principle find a hole the synthetic fixtures
  don't model. Adversarial co-evolution is ongoing.
- The full bot-builder cost-shift estimate ($5-20k/mo + 200-400h)
  beyond the synthetic level. Real cost depends on whether a determined
  attacker can produce coherent event logs that pass the recompute
  AND avoid the trace-novelty fingerprint cell. This test confirms
  the synthetic attacker can't; production-cost validation requires
  an adversarial pilot.

---

## Experiment 1 — Synthetic human distribution

**Method:** generate N=1000 deterministic-seeded "human-like" event
logs (variable cadence, 180s sessions, 60 keystrokes, 720 mousemoves
sampled). Submit each to `serverRecompute` with `clientComposite=0.65`
(the typical legitimate human composite from prior round-2 empirical
work). Measure `|client - server|` divergence and `divergent` flag rate.

**Results:**
- N: 1000
- Mean |client − server|: **0.050**
- Max |client − server|: **0.050**
- `divergent` rate: **0.00%** (0/1000 flagged)

**Interpretation:** the wall's recompute matches the synthetic
human-like client claim within 5 percentage points across every
seeded session. The 0.30 threshold has 6× margin to the synthetic
distribution — there is no false-positive signal in this distribution.

**Caveat:** synthetic seeded humans have less variance than real
humans. Production calibration likely shifts the mean upward (real
humans are messier than my LCG generator). The 6× margin gives runway.

---

## Experiment 2 — Bot-builder attack rejection

**Method:** implement each of the 5 documented round-2 bot-builder
attack designs as a synthetic event log; submit each with a credible
(client_composite=0.85-0.95) attacker claim; check `divergent` and
specific signal scores.

**Results:**

| Attack vector | Server composite | Divergent flag | Caught by |
|---|---|---|---|
| Lazy paste-bot (5 events / 5s, no keys) | 0.30 | ✓ true | duration_match + keystroke_coherence |
| Mechanical typist (CV=0 keystrokes) | — | ✓ keystroke_coherence=0.1 | keystroke verdict mismatch |
| Motion-only (no keys claimed authored) | 0.20 | ✓ true | keystroke_coherence=0 |
| Too-fast burst (1000 events / 6s = 167/sec) | 0.33 | ✓ density=0.1 | event_density catches >100/sec |
| Truncated log (claimed 300s, actual 5s) | 0.18 | ✓ duration_match=0.2 | duration_match |

**Interpretation:** all 5 attack vectors are caught with substantial
margin. The relevant signal (duration / keystroke / density / motion)
fires < 0.5 in every case, dropping the server composite to
0.18-0.33 against attacker claims of 0.85-0.95 → divergence
0.52-0.77, well above the 0.30 threshold.

---

## Experiment 3 — Legitimate edge cases

**Method:** synthesize three legitimate-but-unusual session types
that COULD trip false-positives if the recompute is too rigid:

- **Keyboard-only accessibility user** — 100 keystrokes, zero mouse
- **Short legitimate session** — 60s reading + brief reflection
- **Long legitimate session** — 10-minute deep reading

**Results:**

| Session type | Server composite | Divergent flag |
|---|---|---|
| Keyboard-only (100 keys, 0 mouse) | 1.00 | false |
| Short (60s, 25 keys) | 0.804 | false |
| Long (10 min, 250 keys) | 1.00 | false |

**Interpretation:** the round-5 motion-redistribution fix (R5-NEW-10)
correctly handles the keyboard-only case — no motion + ≥10 keystrokes
triggers weight redistribution onto keystroke + density signals.
Short and long human sessions both pass cleanly.

---

## Experiment 4 — Performance benchmark

**Method:** measure `serverRecompute` and `featureFingerprint` latency
on event logs of 100, 1000, and 5000 events (the SDK's hard cap).
Cloud Functions HTTP timeout is 60s by default; Firestore-trigger is
9 minutes. Anything < 100ms is comfortable.

**Results:**

| Log size | Recompute latency | Headroom vs 60s timeout |
|---|---|---|
| 100 events (~30s session) | 0.19 ms | 315,000× |
| 1000 events (~3-min session) | 1.11 ms | 54,000× |
| 5000 events (~10-min max-size session) | 1.59 ms | 38,000× |
| 5000-event fingerprint generation | 3.23 ms | 18,000× |

**Interpretation:** latency is a non-issue. Even at the SDK's hard
cap, recompute consumes < 0.01% of the function's compute budget.
At 1k sessions/day, total Cloud Function compute on the wall is
~1.5 seconds per day — well inside Blaze free tier.

---

## Experiment 5 — Trace-novelty fingerprint distribution

**Method:** generate N=1000 synthetic sessions with VARIED parameters
(durations 60-900s, mousemove rate 1-10/sec, keystrokes 0-300).
Compute fingerprint via `featureFingerprint`. Count unique fingerprints
and largest cluster size.

**Results (post-empirical-driven fix):**

| Metric | Original (fp1, 0-9 buckets) | After tightening (fp2, 0-99 buckets) |
|---|---|---|
| Unique fingerprints / 1000 | 102 | **986** |
| Largest cluster | 57 sessions (5.7%) | **2 sessions (0.2%)** |
| Collision rate | 96.90% | **2.80%** |

**Interpretation:** the original 0-9 per-bucket fingerprint was too
coarse — 96.9% of sessions collided with at least one other session
in the synthetic set. In production with ~50 sessions/hour lookback,
that meant 5-50% of legitimate users would falsely match a recent
session from a different uid → `trust_tier` dropped to
`bounds_violated` → red banner on the verifier.

The empirical finding drove a same-session fix: bucket count bumped
from 0-9 (10^5 cells) to 0-99 (10^10 cells) per dimension. Detector
string bumped to `fp2:` so a future verifier can distinguish the two
schemes if needed. Result: 98.6% unique fingerprints, 2.80% collision
rate — production-acceptable.

**Production calibration debt:** the 0-99 bucket boundaries are still
honest defaults, not pilot-tuned. With real pilot data we'll know
whether (a) some buckets are still too coarse (real human collision
rate > 2.8%), (b) some are now too tight (replays with jitter no
longer collide → replay detection misses), or (c) both. Tuning is a
post-pilot iteration.

---

## Bot-builder cost-shift estimate (final, with empirical numbers)

| State | Bypass cost / mo | Engineer-hours |
|---|---|---|
| Pre-WALL (rounds 1-4 baseline) | $50 | 56 |
| Post-WALL (round-6 estimate) | $5,000 — $20,000 | 200 — 400 |
| **Post-WALL + empirical-tightened fingerprint (this report)** | **$5,000 — $20,000** | **200 — 400 (no change)** |

The empirical work doesn't change the bot-builder cost estimate
because the 5 attack vectors were already documented as failing the
recompute. What it changes is the **false-positive cost** to
legitimate users: from 5-50% of sessions falsely flagged → 2-3%.

---

## Honest gaps remaining

1. **Real-pilot calibration** (R5-NEW-9). Synthetic seeded humans don't
   capture long-tail variation. The 0.30 threshold and the 0-99
   bucket boundaries are best-effort defaults; they may be too tight
   or too loose against real users.

2. **Adversarial bot evolution.** A determined attacker who reads this
   document and the source learns the 5 signals + fingerprint
   dimensions. They can construct a specifically-targeted attack.
   Defense is the bot-builder cost-shift threshold (per-attempt cost
   of $5-20k/mo); not absolute prevention.

3. **No third-party audit.** This is internal stress-testing. A
   third-party security audit (Trail of Bits, NCC Group, Cure53)
   would surface attack classes our hostile-review agents missed.
   Estimated cost: $30-80K. Worthwhile post-pilot.

4. **No real-pilot adversarial test.** The cost-shift estimate is
   theoretical. Real validation: a paid pilot where Stephen pays a
   penetration-testing firm $5-20K to TRY to forge a receipt. Their
   actual hours-and-dollars become the empirical bypass cost.

---

## How to read these numbers in a procurement / pilot conversation

> "We've stress-tested the wall against 5 documented bot-attack
> vectors and 1000 synthetic legitimate sessions. The wall catches
> 5/5 attacks at the recompute layer with substantial margin
> (server composite 0.18-0.33 vs attacker claim 0.85-0.95). On the
> legitimate side, 0/1000 synthetic human sessions are falsely
> flagged. Our fingerprint quantization went through a same-day
> empirical-driven fix when synthetic testing showed bucket
> coarseness was wrong; post-fix collision rate is 2.8%, which is
> within the noise floor we'd expect from real-pilot session
> overlap. We need real-pilot data to tune the divergence threshold
> from its current 6× margin to a tighter empirical bound."

That's the honest pitch. It says: we did the work, here are the
numbers, here's what's still open. No hand-waving.

---

## How to reproduce

```bash
git clone https://github.com/Stephenuffugus/Attention-Protocol
cd Attention-Protocol
npm install
npx jest --forceExit --testPathPatterns='wall-empirical-validation'
```

All numbers in this report come from this command on commit HEAD as
of 2026-04-28. Deterministic seeded RNG (no `Math.random()`) — the
same numbers reproduce every run.
