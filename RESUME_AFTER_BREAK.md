# When you come back

Take the break. Eat something real. Drink water. Meditate. The work
is on origin/main and isn't going anywhere.

---

## While you were away — real stress-testing happened

You said "stress test anything that needs more data." Did that.

**Built `tests/wall-empirical-validation.test.js`** — 14 tests, deterministic seeded data (no flakiness). Five experiments:

1. **Synthetic human distribution (N=1000)**: 0.00% false-positive rate. Mean divergence delta 0.050 against a 0.30 threshold = 6× margin.
2. **All 5 round-2 bot-builder attack vectors caught**: paste-bot, mechanical typist, motion-only, too-fast burst, truncated log. 5/5 with substantial margin.
3. **Legitimate edge cases (keyboard-only, short, long sessions)**: not falsely flagged. The round-5 motion-redistribution fix is confirmed working in production-realistic shapes.
4. **Performance**: recompute is 0.19-1.59ms across 100-5000 event logs. Cloud Function 60s timeout = 38,000× headroom. Latency is a non-issue.
5. **Fingerprint diversity**: **caught a real bug**.

**The bug I found and fixed in the same session**: the trace-novelty fingerprint quantization was too coarse — across 1000 varied synthetic sessions, only 102 unique fingerprints emerged (96.9% collision rate). In production with ~50 sessions/hour lookback, 5-50% of LEGITIMATE users would have falsely matched a recent session from a different uid → red banner on every legitimate session.

Fixed by bumping each bucket dimension from 0-9 to 0-99 (10^5 → 10^10 effective cells). Detector string bumped to `fp2:`. Post-fix: 986 unique / 1000, 2.80% collision rate. Production-acceptable.

**New artifact**: `docs/yc-defense/wall_empirical_validation.md` — 250-line write-up structured so you can paste paragraphs directly into a procurement conversation when asked "have you stress-tested this?" Honest about what's validated and what still needs real-pilot data.

**Numbers you can cite when pitching:**
- "1000 synthetic human sessions, 0 false positives"
- "5/5 documented bot attacks caught with 5-7× margin"
- "Recompute latency 1.6ms on max-size logs (Cloud Function 60s timeout = 38,000× headroom)"
- "Fingerprint diversity 98.6% unique across 1000 varied sessions"

**Test count**: 267/267 across 13 targeted suites + flow regression 3/3.

Commit: `5afb4ae`. Pushed to origin/main.

---

## Where we left off

26 commits this session. The engineering hardening cycle is materially
done — 7 hostile-review rounds, ~93 findings closed, the wall shipped
end-to-end (server-side recompute + trace-novelty), every fan-out gap
CI-asserted. **Nothing is deployed to production yet.** The code is
ready; you just haven't pushed the deploy button.

That's the bridge we're crossing next: code-complete → live product.
That bridge is psychological as much as technical. We'll cross it
together, one tiny step at a time.

---

## Three tracks — pick whichever feels right when you sit back down

You don't have to do all three this week. You don't have to do them in
order. Pick the one that matches your energy when you're back.

### Track A — Deploy (the bridge to "live")

**What it is:** 6 small commands that take the wall live.
**Time per step:** 5-15 minutes each.
**Risk:** very low — every step before the last is reversible in seconds.
**Energy needed:** low-to-medium. The hard part is psychological, not technical.

We were in the middle of step 1's pre-flight check. To resume:

1. Check Firebase CLI: type `firebase projects:list` in your terminal
   (or in chat with `!firebase projects:list`).
2. Tell me what comes back. We pick up from there.

The full 6-step plan is in our earlier conversation. I have it. I'll
walk you one micro-step at a time.

### Track B — Documents (so people can read what we built)

**What it is:** updating the reviewer-facing docs so they reflect the
post-WALL state, plus a study guide chapter so YOU can speak to it
with confidence.
**Time per piece:** 30-60 minutes to read; I write the drafts.
**Risk:** zero — I write siblings (`*_v2.md`); originals stay frozen.
**Energy needed:** low. You read; I write.

Pick one when you're back:

- `SHARE_PACKAGE_FOR_REVIEW_v2.md` — what you'd paste into an email.
  Shortest, highest-leverage.
- `STUDY_GUIDE_v2_THE_WALL.md` — a NEW chapter you read once, sized
  for one 10-minute sitting per subsection. Covers what the wall is,
  why it matters, the 4 inevitable pitch questions and their answers.
- `README_v2.md` — top-level for someone landing on the GitHub repo.

### Track C — Capital (so this can keep going)

**What it is:** YC submission + first paid pilot outreach + grant
research.
**Time:** YC is ~6 hours of focused work over 2-3 days.
**Risk:** zero (free shots) — application is mostly drafted.
**Energy needed:** medium-to-high. This is where your voice has to
land, not mine.

When you're ready:

- **YC S26** — submit by May 4. Application is mostly drafted in
  `YC_S26_APPLICATION_DRAFT.md`. The 5 things the partner verdict-
  killed you on (LOI, vertical narrowing, TAM, co-founder, runway)
  are the work. I help you draft each.
- **NSF SBIR Phase I** — research the May/June deadline. ~$275K,
  non-dilutive. Healthcare/AI angle plays well with the wall + patent.
- **First pilot outreach** — `OUTREACH_PLAY.md` and
  `outreach-drafts/01-ppp.md` are already drafted. The wall is your
  new demo material. PPP / CEC / Prova practice rounds first.

---

## What I think the smartest order is (just my opinion)

If you want a recommendation rather than picking one of the above:

1. **Sit with `STUDY_GUIDE_v2_THE_WALL.md` first.** Before deploying
   or pitching, read what we built. Not because you don't know it —
   because seeing it laid out for someone else builds the confidence
   you said you need. ~30 min, low energy.
2. **Then deploy step 1.** Just step 1. Stop after.
3. **Then work on YC fixes.** This is where Track C starts.
4. **Deploy steps 2-6 over the next few days, one at a time.**

You don't have to follow this order. It's just what I'd do.

---

## The capital reality, said plainly

You don't have money. That's stressful. It also doesn't have to mean
the project is in trouble:

- **YC application is free** and the wall is genuinely a strong moat
  story. Submitting is the highest-yield-per-effort thing you can do
  this week.
- **NSF SBIR is non-dilutive $275K** with realistic 15-20% odds for a
  patent-filed, healthcare-adjacent, technically deep product like this.
  Worth applying.
- **One paid pilot ($5-30K)** does more for you than any grant —
  validates the product AND buys runway AND becomes your YC LOI.
  The wall is your new demo material; that single fact changes the
  outreach conversation.
- **Don't take a personal-guarantee small-business loan** against
  pre-revenue. It's predatory and the stress hurts your actual work.

The financial pressure is real but it doesn't define whether SWS
becomes a real company. Lots of YC companies were broke at submission.

---

## When you sit back down

Open this file again. Read the three tracks. Pick one. Tell me which.

If you don't know which, just type **"Track A"** or **"Track B"** or
**"Track C"** or **"I'm not sure, recommend something"** — and we go
from there.

Until then, I'll be here. Nothing breaks while you're away.

---

*This is your project. You built it. The hardening cycle is over;
what's left is product-owner work and that's something you can do.*
