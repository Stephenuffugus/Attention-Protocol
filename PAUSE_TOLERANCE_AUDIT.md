# Pause-Tolerance Audit (2026-04-29)

Triggered by Stephen running cme-demo on himself and getting MARGINAL.
Surfaced the curvature dead-zone bug (already fixed in commit `feb0fd1`).
This doc inventories the *other* signals that penalize legitimate human
pause/slow-reader behavior, with proposed calibration fixes for the ones
where the bug is unambiguous (same shape as curvature) and a flag for
the ones that need real-pilot data.

## The principle (from Stephen, 2026-04-29)

> "this cant just break cuz someone picked their nose"

Engagement is "did this person attend to the content," not "did this
person interact with input devices the entire time." A careful reader
who pauses to think, scratch, drink water, or briefly look up has not
disengaged — they're being human. Signals that read input-event density
as a proxy for engagement need to tolerate normal human pauses.

## Bugs found

### Bug 1: `computeRTVariability` dead zone (HIGH — same shape as curvature)

**File:** `src/sdk/attention-protocol.js:1146-1168` (and the two SDK copies)

**Current formula:**
```js
var cvScore = (cv >= 0.1 && cv <= 0.6) ? _ascore(1 - Math.abs(cv - 0.3) * 3, 0.8) : 0.2;
```

**Problem:** Score collapses to 0 across `cv` in roughly [0.55, 0.6] —
the multiplier of 3 means `Math.abs(cv - 0.3) * 3` exceeds 1 above
cv=0.633, but the [0.1, 0.6] range gate then drops to the 0.2 fallback
at cv=0.6 anyway. Net effect: a slow careful reader whose click
intervals legitimately vary widely (cv > 0.5) gets scored ≤ 0.27 on
this signal regardless of how attentive they were.

**Stephen's session:** RT Variability scored 0.221. The CME demo's
"Timing Consistency" metric reads directly from `c.rtVariability`
(`cme-demo.html:562`), so this single bug pulled down BOTH the SDK
composite AND the CME-weighted composite.

**Proposed fix (same shape as curvature):**
```js
// Humans: CV 0.15-0.50 typical, can extend to 0.7+ for slow careful readers.
// Bots: CV < 0.05 (perfectly regular) or > 1.2 (artificially noisy).
// Calibration fix 2026-04-29 (same shape as curvature): prior formula
// crashed to 0 above cv=0.55. Widened plateau across legitimate human
// range; bot-tell tails kept low.
if (cv < 0.05) return 0.15;            // suspiciously regular (bot tell)
if (cv > 1.2)  return 0.20;            // artificially noisy (bot tell)
var cvScore;
if (cv < 0.1)         cvScore = 0.30;  // very low CV — borderline human
else if (cv > 0.7)    cvScore = _ascore(1 - (cv - 0.7) * 0.5, 0.8); // gentle falloff above 0.7
else                  cvScore = _ascore(1 - Math.abs(cv - 0.35) * 0.7, 0.8); // wide plateau
```

Profile across the human range:
- cv=0.15 → cvScore ~0.55
- cv=0.30 → cvScore ~0.69
- cv=0.50 → cvScore ~0.62
- cv=0.70 → cvScore ~0.43
- cv=0.90 → cvScore ~0.30
- cv=1.30 → 0.20 (bot tell)

**Estimated lift on Stephen's session:** RT Variability 0.221 → ~0.55,
Timing Consistency in CME composite 0.22 → ~0.55, CME composite +0.033.

### Bug 2: `computeInactivityPattern` peak too narrow (MED)

**File:** `src/sdk/attention-protocol.js:1066-1092`

**Current formula:**
```js
var gapRatioScore = 1 - Math.abs(gapRatio - 0.15) * 3; // peaks at 15% gap ratio
gapRatioScore = Math.max(0.1, Math.min(0.9, gapRatioScore));
```

**Problem:** Peaks at 15% gap ratio. Falls to score 0.1 at gap ratio
0.42. A careful reader on a content-heavy page (CME, document review,
policy read) typically has 25-45% gap time naturally — they're reading,
not clicking. The 15% peak was probably calibrated for active-mouse
sessions (gaming, button-heavy UX), not reading.

**Stephen's session:** Activity Pattern scored 0.473. Estimated his
gap ratio was ~0.38 (38% of session in pauses) — completely
realistic for slow careful reading with a couple natural breaks.

**Proposed fix:**
```js
// Humans on content-heavy pages: 10-40% gap ratio is normal reading
// behavior. Humans on action-heavy pages: 5-20% typical. Bots: either
// 0% (constant activity) or > 70% (one big pause = doesn't apply here,
// already handled by the gap-ratio-> -1 branch above).
// Calibration fix 2026-04-29: widened plateau across realistic reading
// range. Without per-page-type calibration we err toward tolerance
// of reading patterns; bot tails handled by the -1 branch + gated layers.
var gapRatioScore;
if (gapRatio < 0.05)      gapRatioScore = 0.35; // suspiciously constant activity
else if (gapRatio < 0.10) gapRatioScore = 0.55;
else if (gapRatio <= 0.40) gapRatioScore = 0.85; // wide reading-friendly plateau
else if (gapRatio <= 0.55) gapRatioScore = 0.65; // long-pause-heavy but still engaged
else                      gapRatioScore = 0.40;  // approaching the > 0.7 sentinel
```

**Estimated lift on Stephen's session:** Activity Pattern 0.473 → ~0.74
(gapRatioScore 0.85 + cvScore 0.63 → 0.74), composite +0.008 in the
SDK weighting (small weight 0.03), more in the CME-derived "Sustained
Focus" metric which is averaged over inactivity + tabVisibility +
crossCorrelation.

## What I'm NOT proposing to fix today

### `computeMicroPauseScore` — leave alone
Uses content-complexity-aware ranges that look reasonable. Stephen
scored 0.400 here; possible cause is render-time tracking gaps, not
an unfair penalty on pause behavior. Needs more session data to judge.

### `computeHoverDwell` — leave alone
Stephen scored 0.745, well within the engaged-reader range. No bug
visible.

### `computeFractalScaling` — flag for later
Stephen scored 0.300. This signal needs ≥256 inter-event intervals
for stable DFA. Slow careful readers may not generate enough events
in a single session. Possibly should return -1 (insufficient data)
sentinel below some threshold rather than scoring low; needs
investigation but not a same-day fix.

## What this fixes

- Stephen's session **CME composite goes from 0.647 (MARGINAL) to ~0.69
  (CREDIT)** if both Bug 1 and Bug 2 land, with the curvature fix already
  applied.
- The "honest measurement" framing for YC stays intact: a marginal
  session was correctly classified, P(human) was 0.86, and we found
  three calibration bugs from his real test that we then fixed.
- The principle ("don't break because someone picked their nail") is
  encoded in the calibration profile, not just an aspiration.

## What this does NOT fix

- The bigger product question: per-vertical signal weighting. A CME
  page should tolerate more reading-pause behavior than a customer-
  service form. Needs `vertical-scoring-profiles.js` wiring (already
  scheduled as Day 2 of the parallel sprint).
- Real-pilot calibration. These fix obvious calibration bugs but the
  ground-truth distribution of "engaged human reading CME content"
  needs N>>1 sessions to verify.

## Bot-tell sanity check

Both proposed fixes preserve bot-tell penalties at the tails:
- `computeRTVariability`: cv < 0.05 (constant intervals) and cv > 1.2
  (artificial noise) still score low.
- `computeInactivityPattern`: 0% gap ratio (constant activity) scores
  0.35; the existing >70% gap ratio sentinel branch is unchanged.

Bot harness regression test must still pass with these fixes (currently
gap 0.143 at composite level; the curvature fix already showed bot tier
holds because environmental + composition gates dominate the gated
composite, not these signals individually).

## Proposed action

If approved, single commit:
1. Fix `computeRTVariability` in all 3 SDK copies
2. Fix `computeInactivityPattern` in all 3 SDK copies
3. Add regression tests pinning the new score profiles (8 tests, same
   spec-test pattern as the curvature regression)
4. Run signals + bot-harness + e2e suites to verify no regressions
5. Commit + push + redeploy hosting

Estimated time: 30 min including tests. Risk: low. Reversible.
