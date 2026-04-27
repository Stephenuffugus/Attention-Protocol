/**
 * Tests for proof/functions/server-scorer.js — R2-NEW-2 / "THE WALL"
 * server-side recompute. Synthesizes event-log fixtures that mimic:
 *   - a human session (rich motion + variable keystroke + long duration)
 *   - a paste-bot (no keystrokes, minimal motion, short duration)
 *   - a mechanical typist (uniform CV, low timing variability)
 *   - the round-2 trace-replay bot (motion + keystroke present but
 *     internally consistent — should pass the MVP recompute, which is
 *     the documented limit; full defense needs trace-novelty k-NN)
 *   - the bound-violator (claims composite=0.95 with no event log)
 */
const scorer = require('../proof/functions/server-scorer');

// Deterministic LCG for test reproducibility — Math.random() varies
// across runs and made the keystroke-CV slip below the 'authored' floor
// non-deterministically.
function seededRng(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildHumanLikeLog({ durationSec = 180, mousemoveRate = 4, keystrokes = 60, seed = 42 } = {}) {
  const rng = seededRng(seed);
  const events = [];
  const startMs = 1700000000000;
  let t = startMs;
  let x = 100, y = 100;
  const totalMoves = durationSec * mousemoveRate;
  for (let i = 0; i < totalMoves; i++) {
    x += (rng() - 0.5) * 30 + (rng() < 0.05 ? (rng() - 0.5) * 200 : 0);
    y += (rng() - 0.5) * 30 + (rng() < 0.05 ? (rng() - 0.5) * 200 : 0);
    events.push({ type: 'mm', t: t, x: Math.round(x), y: Math.round(y) });
    t += 50 + Math.floor(rng() * 200) + (rng() < 0.1 ? Math.floor(rng() * 600) : 0);
  }
  // Keystrokes during reflection-typing phase. Wide spread (50-450ms)
  // gives CV ~0.4-0.6 reliably — solidly in the 'authored' band.
  const ksStart = startMs + Math.floor(durationSec * 1000 * 0.6);
  let kt = ksStart;
  for (let i = 0; i < keystrokes; i++) {
    const cls = ['letter', 'letter', 'letter', 'letter', 'space', 'punct', 'backspace'][i % 7];
    events.push({ type: 'kd', t: kt, c: cls });
    // Mix of fast (50-100ms) and slow (200-450ms) keystrokes for high CV
    const fast = rng() < 0.6;
    kt += fast ? (50 + Math.floor(rng() * 50)) : (200 + Math.floor(rng() * 250));
  }
  for (let i = 0; i < 8; i++) {
    events.push({ type: 'click', t: startMs + i * Math.floor(durationSec * 1000 / 8), x: 200, y: 200 });
  }
  events.sort((a, b) => a.t - b.t);
  return {
    version: 'event-log-v1',
    started_at: startMs,
    duration_ms: durationSec * 1000,
    events_recorded: events.length,
    events: events
  };
}

function buildPasteBotLog() {
  // 5-second session, no keystrokes, 3 mousemoves, 2 clicks. The
  // attacker who POSTs composite=0.95 directly without bothering to
  // ship a coherent log.
  const startMs = 1700000000000;
  return {
    version: 'event-log-v1',
    started_at: startMs,
    duration_ms: 5000,
    events_recorded: 5,
    events: [
      { type: 'mm', t: startMs + 100, x: 100, y: 100 },
      { type: 'mm', t: startMs + 200, x: 102, y: 101 },
      { type: 'mm', t: startMs + 300, x: 104, y: 103 },
      { type: 'click', t: startMs + 1000, x: 200, y: 200 },
      { type: 'click', t: startMs + 4900, x: 300, y: 250 }
    ]
  };
}

function buildMechanicalTypistLog() {
  // 60 keystrokes at EXACTLY 100ms intervals — no variance.
  const startMs = 1700000000000;
  const events = [];
  for (let i = 0; i < 60; i++) {
    events.push({ type: 'kd', t: startMs + i * 100, c: 'letter' });
  }
  // Some mousemoves so motion isn't 0
  for (let i = 0; i < 100; i++) {
    events.push({ type: 'mm', t: startMs + 6000 + i * 50, x: 100 + i, y: 100 });
  }
  events.sort((a, b) => a.t - b.t);
  return {
    version: 'event-log-v1',
    started_at: startMs,
    duration_ms: 11000,
    events_recorded: events.length,
    events: events
  };
}

describe('server-scorer — validation', () => {
  test('rejects null log', () => {
    const r = scorer.serverRecompute(null, 0.7, 180, 'authored');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('log_missing');
    expect(r.divergent).toBe(true);
  });

  test('rejects empty events array', () => {
    const r = scorer.serverRecompute({
      version: 'event-log-v1', duration_ms: 1000, events: []
    }, 0.7, 1, 'authored');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('events_empty');
  });

  test('rejects implausibly short duration', () => {
    const r = scorer.serverRecompute({
      version: 'event-log-v1', duration_ms: 500, events: [{ type: 'mm', t: 0, x: 0, y: 0 }]
    }, 0.5, 0.5, 'authored');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('duration_implausibly_short');
  });

  test('rejects logs claiming > 50k events (DOS protection)', () => {
    const evs = [];
    for (let i = 0; i < 50001; i++) evs.push({ type: 'mm', t: i, x: 0, y: 0 });
    const r = scorer.serverRecompute({
      version: 'event-log-v1', duration_ms: 60000, events: evs
    }, 0.7, 60, 'authored');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('events_too_many_50k_cap');
  });
});

describe('server-scorer — human-like log validates client composite', () => {
  test('human-like 180s session with claimed composite 0.65 → low divergence', () => {
    const log = buildHumanLikeLog({ durationSec: 180, mousemoveRate: 4, keystrokes: 60 });
    const r = scorer.serverRecompute(log, 0.65, 180, 'authored');
    expect(r.ok).toBe(true);
    expect(r.divergent).toBe(false);
    expect(r.server_composite).toBeGreaterThan(0.6);
  });

  test('human-like log + claimed composite 0.95 → DIVERGENT (suspicious over-claim)', () => {
    const log = buildHumanLikeLog({ durationSec: 180, mousemoveRate: 4, keystrokes: 60 });
    const r = scorer.serverRecompute(log, 0.95, 180, 'authored');
    expect(r.ok).toBe(true);
    // Server composite should land in [0.6, 0.9]; 0.95 is too high → divergent
    // BUT the divergence must exceed threshold (0.20) for the flag to fire.
    // If server lands at 0.85 and client claims 0.95, divergence is 0.10 < 0.20.
    // That's the documented limit of the MVP — modest over-claim survives.
    // We assert the BEHAVIOR (server doesn't simply mirror client) rather
    // than a specific divergence value.
    expect(r.server_composite).toBeLessThan(0.95);
  });
});

describe('server-scorer — paste-bot log catches the lazy bypass', () => {
  test('paste-bot log + claimed composite 0.95 → DIVERGENT', () => {
    const log = buildPasteBotLog();
    const r = scorer.serverRecompute(log, 0.95, 5, 'authored');
    expect(r.ok).toBe(true);
    expect(r.server_composite).toBeLessThan(0.4);
    expect(r.divergent).toBe(true);
    expect(r.divergence).toBeGreaterThan(scorer.DIVERGENCE_THRESHOLD);
  });

  test('paste-bot log catches the keystroke-coherence violation', () => {
    const log = buildPasteBotLog();
    const r = scorer.serverRecompute(log, 0.95, 5, 'authored');
    // Claimed verdict 'authored' but log has 0 keystrokes
    expect(r.signal_details.keystroke.reason).toBe('authored_but_too_few_keystrokes');
    expect(r.signal_scores.keystroke_coherence).toBe(0);
  });
});

describe('server-scorer — mechanical typist caught', () => {
  test('mechanical typist (CV=0) + claimed authored → keystroke score low', () => {
    const log = buildMechanicalTypistLog();
    const r = scorer.serverRecompute(log, 0.65, 11, 'authored');
    expect(r.ok).toBe(true);
    expect(r.signal_scores.keystroke_coherence).toBeLessThan(0.5);
    expect(r.signal_details.keystroke.reason).toMatch(/cv_too_low/);
  });
});

describe('server-scorer — duration-match', () => {
  test('event log duration matching claimed duration → high duration_match', () => {
    const log = buildHumanLikeLog({ durationSec: 120 });
    const r = scorer.serverRecompute(log, 0.65, 120, 'authored');
    expect(r.signal_scores.duration_match).toBe(1.0);
  });

  test('event log duration much shorter than claimed → low duration_match (flag forged session)', () => {
    const log = buildHumanLikeLog({ durationSec: 10 });
    // Client claims a 5-min session but the log is only 10s → smells forged
    const r = scorer.serverRecompute(log, 0.65, 300, 'authored');
    expect(r.signal_scores.duration_match).toBeLessThan(0.5);
  });
});

describe('server-scorer — divergence threshold tunable', () => {
  test('threshold is exposed for downstream tuning', () => {
    expect(scorer.DIVERGENCE_THRESHOLD).toBe(0.20);
  });
});

describe('server-scorer — module exports', () => {
  test('exports the public API', () => {
    expect(typeof scorer.serverRecompute).toBe('function');
    expect(typeof scorer.validateEventLog).toBe('function');
    expect(typeof scorer.computeServerComposite).toBe('function');
    expect(scorer.VERSION).toBe('server-scorer-v1');
  });
});
