/**
 * Round-9 stopgap regression — pins the measured behavior of the 4
 * tourniquet changes landed in proof/functions/server-scorer.js after
 * the 2026-05-18 adversarial break (project_skeptic_round_may18_v9_*).
 *
 * What this test does and does NOT prove:
 *   - PROVES vec3 (logic-abuse / no-motion-redistribution) is closed
 *     by the combination of STOPGAP-1 (cap on no-motion branch),
 *     STOPGAP-2 (server_composite>=0.75 floor for server_attested), and
 *     STOPGAP-3 (motion-flip refused without declared device class).
 *   - PROVES STOPGAP-4 (Number() coercion of duration_sec) closes the
 *     string-vs-number asymmetry in extractSessionMetrics.
 *   - DOES NOT prove vec1 (white-box pure synthesis with motion + kd +
 *     scroll) is closed. It is not. server_composite still reaches 1.0
 *     from perfect synthetic sub-scores. Only the H1 challenge-binding
 *     fix closes that class.
 *   - DOES NOT prove vec2 (jittered replay of one recorded human trace)
 *     is closed. fp2 trace-novelty fails at 10ms+3px jitter. Only
 *     time-evolving challenges + per-session liveness closes it.
 *
 * If these "still open" facts change — i.e., vec1/vec2 also start
 * failing — that is news. Add new tests; don't delete the open-by-
 * design asserts here without a measured H1 result behind them.
 */
'use strict';

const scorer = require('../proof/functions/server-scorer');

// ───────────────────────────────────────────────────────────────────
// Shared fixtures (kept inline so the test file is the audit trail).
// ───────────────────────────────────────────────────────────────────

function seededLcg(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Vec3-case-F shape: 150 synthesised keydowns, no mousemoves, no scroll.
// Pre-stopgap result: motionApplicable flipped false, server_composite
// 0.84, trustTier server_attested at claimed composite 1.0.
function vec3SyntheticKbLog(n, durMs) {
  const ev = [];
  let t = 0;
  const gap = durMs / n;
  for (let i = 0; i < n; i++) {
    const f = 0.4 + 1.6 * (0.5 + 0.5 * Math.sin(i * 2.39 + Math.cos(i)));
    t += Math.max(1, Math.round(gap * f));
    ev.push({ type: 'kd', t: t });
  }
  return { events: ev, duration_ms: Math.max(durMs, t + 50) };
}

// Vec3-case-C/D shape: 400 generic-type events, no motion, no kd, no
// scroll. Pre-stopgap recomputed to 0.70 (motion weight wasted) yet
// still earned server_attested because no bounds_violations fired.
function vec3GenericTimingLog(n, durMs) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    const base = (i / n) * durMs;
    const jit = (Math.sin(i * 1.37) * 0.5 + 0.5) * (durMs / n) * 1.2;
    ev.push({ type: 'evt', t: Math.round(base + jit) });
  }
  ev.sort((a, b) => a.t - b.t);
  for (let k = 1; k < ev.length; k++) {
    if (ev[k].t <= ev[k - 1].t) ev[k].t = ev[k - 1].t + 1;
  }
  return { events: ev, duration_ms: durMs };
}

// Vec1 shape: full white-box synthesis with motion + kd + scroll
// engineered to max every sub-scorer. Reproduced here for the "still
// open" assertion that documents what the stopgap does NOT close.
function vec1FullSynthesisLog(durMs) {
  const ev = [];
  let t = 0;
  const rng = seededLcg(1234567);
  let x = 400, y = 300;
  for (let i = 0; i < 600; i++) {
    const step = (i % 3 === 0) ? 120 : 4;
    const ang = rng() * Math.PI * 2;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    const dt = 8 + Math.floor(rng() * 82);
    t += dt;
    ev.push({ type: 'mm', t: t, x: Math.round(x), y: Math.round(y) });
  }
  for (let k = 0; k < 40; k++) {
    t += 60 + Math.floor(rng() * 340);
    ev.push({ type: 'kd', t: t });
  }
  for (let s = 0; s < 20; s++) {
    t += 150 + Math.floor(rng() * 200);
    ev.push({ type: 'scroll', t: t });
  }
  return { events: ev, duration_ms: durMs };
}

// Fake firebase-admin whose session_fingerprints lookup returns zero
// matches — models a brand-new attacker fingerprint. The harshest
// realistic stub for the attacker, because in production a returning
// fingerprint would CAUGHT-flag anyway.
function fakeAdmin() {
  const fs = function () {
    return {
      collection: () => ({
        where: function () { return this; },
        limit: function () { return this; },
        get: () => Promise.resolve({ docs: [] }),
        add: () => Promise.resolve()
      })
    };
  };
  fs.Timestamp = { fromMillis: m => m };
  fs.FieldValue = { serverTimestamp: () => 0 };
  return { admin: { firestore: fs } };
}

// ───────────────────────────────────────────────────────────────────
// STOPGAP-1: cap server_composite <= 0.65 on motionApplicable===false.
// ───────────────────────────────────────────────────────────────────
describe('R9-STOPGAP-1: no-motion branch is capped at 0.65', () => {
  test('computeServerComposite caps when motionApplicable=false', () => {
    const allOnes = {
      timing_cv: 1, motion: 0, keystroke_coherence: 1,
      duration_match: 1, event_density: 1
    };
    // Without the cap, no-motion branch reweights to
    // 1*0.30 + 0*0 + 1*0.40 + 1*0.10 + 1*0.20 = 1.0.
    // Post-stopgap: capped at 0.65.
    const capped = scorer.computeServerComposite(allOnes, false);
    expect(capped).toBeLessThanOrEqual(0.65);
  });

  test('motionApplicable=true branch is NOT capped (legitimate desktop)', () => {
    const allOnes = {
      timing_cv: 1, motion: 1, keystroke_coherence: 1,
      duration_match: 1, event_density: 1
    };
    const uncapped = scorer.computeServerComposite(allOnes, true);
    expect(uncapped).toBeCloseTo(1.0, 2);
  });
});

// ───────────────────────────────────────────────────────────────────
// STOPGAP-2: server_attested tier requires server_composite >= 0.75.
// ───────────────────────────────────────────────────────────────────
describe('R9-STOPGAP-2: server_attested floor is 0.75', () => {
  test('vec3 case D (composite=0.84, generic-event log, server~0.70) → NOT server_attested', async () => {
    const log = vec3GenericTimingLog(400, 120000);
    const meta = scorer.extractSessionMetrics({
      session_id: 's-vec3-D', composite: 0.84, duration_sec: 120,
      interaction_count: 25,
      composition_integrity: { verdict: 'pasted' },
      environmental: { loaded: true, bot: false },
      event_log: log
    });
    const w = await scorer.runWall(meta, fakeAdmin());
    expect(w.trustTier).not.toBe('server_attested');
    expect(w.serverRecomputeResult.server_composite).toBeLessThan(0.75);
  });
});

// ───────────────────────────────────────────────────────────────────
// STOPGAP-3: motionApplicable cannot flip without a declared device class.
// ───────────────────────────────────────────────────────────────────
describe('R9-STOPGAP-3: no-flip without declared device class', () => {
  test('vec3 case F (synthetic-kb log, no device_class) → bounds_violated, NOT server_attested', async () => {
    const log = vec3SyntheticKbLog(150, 72000);
    const meta = scorer.extractSessionMetrics({
      session_id: 's-vec3-F', composite: 1.0,
      duration_sec: Math.round(log.duration_ms / 1000),
      interaction_count: 25,
      composition_integrity: { verdict: 'authored' },
      environmental: { loaded: true, bot: false }, // no device_class
      event_log: log
    });
    const w = await scorer.runWall(meta, fakeAdmin());
    expect(w.trustTier).not.toBe('server_attested');
    // Motion weight stays at 0.30 (not redistributed) so the 0-score motion
    // signal pulls the composite below the 0.75 floor.
    expect(w.serverRecomputeResult.server_composite).toBeLessThan(0.75);
  });

  test('vec3 case F MAX-attested binary search yields no attested composite', async () => {
    const log = vec3SyntheticKbLog(150, 72000);
    let lo = 0.5, hi = 1.0, best = null;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const meta = scorer.extractSessionMetrics({
        session_id: 's-G', composite: Number(mid.toFixed(5)),
        duration_sec: Math.round(log.duration_ms / 1000),
        interaction_count: 25,
        composition_integrity: { verdict: 'authored' },
        environmental: { loaded: true, bot: false },
        event_log: log
      });
      const w = await scorer.runWall(meta, fakeAdmin());
      if (w.trustTier === 'server_attested') { best = mid; lo = mid; }
      else hi = mid;
    }
    expect(best).toBeNull();
  });

  test('legitimate keyboard-only user WITH declared device_class still redistributes', () => {
    // Direct serverRecompute call with NO opts preserves auto-flip
    // (legacy path used by the existing motion-redistribution tests).
    const startMs = 1700000000000;
    const ev = [];
    for (let i = 0; i < 80; i++) {
      ev.push({ type: 'kd', t: startMs + i * (90 + (i % 7) * 30), c: 'letter' });
    }
    const log = { events: ev, duration_ms: 12000, started_at: startMs,
                  events_recorded: ev.length, version: 'event-log-v1' };
    const r = scorer.serverRecompute(log, 0.65, 12, 'authored');
    // Pre-stopgap (auto-detect on, no cap): server_composite > 0.5.
    // Post-stopgap (auto-detect on but NEW cap of 0.65): still >= 0.5.
    expect(r.server_composite).toBeGreaterThan(0.5);
    expect(r.server_composite).toBeLessThanOrEqual(0.65);
  });
});

// ───────────────────────────────────────────────────────────────────
// STOPGAP-4: duration_sec uses Number() coercion (kills the asymmetry).
// ───────────────────────────────────────────────────────────────────
describe('R9-STOPGAP-4: duration_sec Number() coercion', () => {
  test('string-numeric duration_sec coerces to number, not 0', () => {
    const a = scorer.extractSessionMetrics({ composite: 0.5, duration_sec: '120' });
    expect(a.durationSec).toBe(120);
  });

  test('string-numeric duration_ms coerces to seconds, not 0', () => {
    const a = scorer.extractSessionMetrics({ composite: 0.5, duration_ms: '60000' });
    expect(a.durationSec).toBe(60);
  });

  test('unparseable duration_sec falls through to 0 (not NaN)', () => {
    const a = scorer.extractSessionMetrics({ composite: 0.5, duration_sec: 'not a number' });
    expect(a.durationSec).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────
// HONEST OPEN GAPS — these assertions document what the stopgap does
// NOT close. If they ever flip green, it means the stopgap was wider
// than expected (good news) OR something else changed and we need to
// re-investigate. Either way, the assertion is the canary.
// ───────────────────────────────────────────────────────────────────
describe('R9 still-open gaps (these tests intentionally document the open class)', () => {
  test('OPEN: vec1 white-box pure-synthesis with full motion still reaches server_attested', async () => {
    const log = vec1FullSynthesisLog(95000);
    const meta = scorer.extractSessionMetrics({
      session_id: 's-vec1', composite: 0.85, duration_sec: 95,
      interaction_count: 25,
      composition_integrity: { verdict: 'authored' },
      environmental: { loaded: true, bot: false },
      event_log: log
    });
    const w = await scorer.runWall(meta, fakeAdmin());
    // Intentional: this is the documented open class. H1 challenge-
    // binding is the fix, not these 4 stopgap changes. If this ever
    // returns NOT server_attested by accident, investigate before
    // celebrating — it may be a calibration shift, not a real fix.
    expect(w.trustTier).toBe('server_attested');
    expect(w.serverRecomputeResult.server_composite).toBeGreaterThanOrEqual(0.75);
  });
});
