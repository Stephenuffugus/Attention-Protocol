# CME Signal-Default Diagnosis (Bug Triage)

Source: agent investigation 2026-04-26. Five signals returned hardcoded defaults across all 5 real CME runs. This document is the diagnostic; the patches go in `proof/cme-demo.html`.

## Summary Table

| Signal | Hardcoded Default | Root Cause | Minimal Fix |
|---|---|---|---|
| Hick's Law | 0.500 | Needs ≥5 decisions across ≥2 different option counts; CME has only 3 quiz Qs all 4-option | Add 2 more questions with varied option counts (true/false, 5-option list) |
| Micro-Pause | 0.500 | CME never calls `recordContentRender()` | Call `recordContentRender(complexity)` on each section/question render (1 line per) |
| Hover Dwell | 0.000 (sentinel -1) | CME has no mouseover/mouseout listeners | Add hover listeners to `.opt` elements (4-line block) |
| Activity Pattern | 0.000 (sentinel -1) | Auto-tracks via `_trackInteraction`, but session sometimes < 60s threshold | Most CME runs ≥60s already; if forced to fail-safe, surface as N/A not 0 |
| Scroll Backtrack | 0.000 (sentinel -1) | CME sections are static divs with no scrollable content; SDK doesn't track body-scroll | Add scroll listener to body OR mark sections scrollable + listen on each |

## Detail per Signal

### 1. Hick's Law (line 451-496 in `proof/sdk/attention-protocol.js`)

**Default trigger:** `_decisionLog.length < 5` OR `groupKeys.length < 2` (different option counts)

**Honest fix (NOT synthetic data):** vary the CME quiz to span more option counts. Currently 3 questions × 4 options. Change to:
- Q1: 2-option (true/false)
- Q2: 3-option
- Q3: 4-option
- Q4: 5-option
- Q5: 4-option

This satisfies both the count and option-variation requirements legitimately.

**Do NOT** seed synthetic decisions — that fakes the signal and invalidates the receipt.

### 2. Micro-Pause (line 526-561 in `proof/sdk/attention-protocol.js`)

**Default trigger:** `completed.length < 3` (no completed render→interaction pairs)

**Fix:** Call `SWSAttention.recordContentRender(complexity)` when each section/question becomes visible. The SDK auto-pairs the render with the next interaction.

```js
// In nextSection(), after section is shown:
SWSAttention.recordContentRender('moderate');

// In question render loop:
SWSAttention.recordContentRender(qOptionCount > 4 ? 'complex' : 'moderate');
```

### 3. Hover Dwell (line 847-857)

**Default trigger:** `_hoverLog.length < 5`. SDK returns sentinel -1; composition treats as 0.

**Fix on desktop:** Add mouseover/mouseout listeners on quiz options.

```js
document.addEventListener('mouseover', function(e) {
  var el = e.target.closest('.opt');
  if (el) SWSAttention.recordHoverEnter(el.className);
});
document.addEventListener('mouseout', function(e) {
  var el = e.target.closest('.opt');
  if (el) SWSAttention.recordHoverLeave();
});
```

**On mobile:** signal should be N/A (no hover concept), not 0. Composite must treat absent-hover-on-mobile as N/A and reweight, NOT penalize.

### 4. Activity Pattern (line 959-987)

**Default trigger:** `sessionDuration < 60000` returns -1.

**Reality check:** All 5 real CME runs were ≥60s (216s, 188s, 313s, 227s, 310s). So this should not be defaulting in those runs — but it does in the receipts we have. **Investigate further:** the receipt shows the value at submit time, but `_inactivityGaps` may be empty if the user clicked steadily without pausing >3000ms. If so, returning -1 is wrong; "no inactivity gaps in 5-minute session" is itself a signal of focus and should score positively.

**Recommended fix:** SDK change — if `sessionDuration > 60000` AND `_inactivityGaps.length === 0`, return 0.85 (active focus) not 0.55. Currently line 963-966 returns 0.55.

### 5. Scroll Backtrack (line 1068-1092)

**Default trigger:** `_scrollReversals.length < 2` OR `_scrollLog.length < 30` OR `sessionDuration < 120000`.

**Root cause:** CME page sections are not scrollable containers. The body scrolls. SDK's scroll-tracking expects `recordElementScroll(scrollTop)` calls.

**Fix:** Add a window scroll listener that throttles to ~5Hz:

```js
var _lastScrollEmit = 0;
window.addEventListener('scroll', function() {
  var now = Date.now();
  if (now - _lastScrollEmit < 200) return;
  _lastScrollEmit = now;
  SWSAttention.recordElementScroll(window.scrollY);
}, { passive: true });
```

This matches the demo flow's scroll instrumentation.

## Note on Mobile Signal Handling

Currently the SDK's signal-composition code (line 1504 area) treats `-1` sentinel as `0.0`. That penalizes mobile users for hover (no hover concept on touch). The composite needs three states:
- Real value (0.0 - 1.0)
- N/A on this device (exclude from composite, redistribute weight)
- Insufficient data (default to 0.5 or honest neutral)

Currently it conflates the latter two, which is the root of the mobile-penalty bug we observed across all CME runs.
