/**
 * round9-vec2-poc.js — Red-team attack vector 2: fp2 replay economics.
 *
 * TARGET: proof/functions/server-scorer.js
 *   - featureFingerprint() ("fp2" trace-novelty replay defense)
 *   - serverRecompute() (THE WALL composite recompute)
 *
 * CLAIM UNDER TEST: fp2 has ~10^10 effective cells, so mass-replays of a
 * single recorded human trace "collide" on fingerprint and trip
 * trace_novelty_low. Therefore one recorded trace cannot mint many clean
 * receipts cheaply.
 *
 * METHOD:
 *   1. Take ONE canonical human-like log (the exact buildHumanLikeLog
 *      generator from tests/server-scorer.test.js, which the repo's own
 *      test at line 139-145 proves passes serverRecompute non-divergent
 *      at claimed composite 0.65).
 *   2. Generate N=1000 jittered replays at several Gaussian-noise levels.
 *      Jitter is PURE MECHANICAL NOISE: per-event timestamp wobble,
 *      per-coordinate wobble, and small count perturbation. No per-trace
 *      human work — exactly the "$0 of attacker effort" model.
 *   3. For each replay compute the REAL exported featureFingerprint() and
 *      measure collision rate vs the original (collision == caught).
 *   4. For each replay also run the REAL exported serverRecompute() and
 *      check it stays non-divergent (the receipt would still be clean).
 *   5. Report collision-rate AND clean-pass-rate vs jitter. The attacker
 *      win condition: a jitter where <5% collide AND a high fraction
 *      still pass serverRecompute non-divergent.
 *
 * No network. No external comms. Reads only the real module.
 */
'use strict';

var scorer = require('../proof/functions/server-scorer');

// ─────────────────────────────────────────────────────────────────────
// Deterministic LCG — identical to tests/server-scorer.test.js so the
// base trace is byte-for-byte the repo's canonical "good human" fixture.
// ─────────────────────────────────────────────────────────────────────
function seededRng(seed) {
  var state = seed >>> 0;
  return function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// EXACT copy of tests/server-scorer.test.js buildHumanLikeLog. The repo's
// own test proves: serverRecompute(log, 0.65, 180, 'authored') →
// ok:true, divergent:false, server_composite > 0.6.
function buildHumanLikeLog(opts) {
  opts = opts || {};
  var durationSec = opts.durationSec || 180;
  var mousemoveRate = opts.mousemoveRate || 4;
  var keystrokes = opts.keystrokes || 60;
  var seed = opts.seed || 42;
  var rng = seededRng(seed);
  var events = [];
  var startMs = 1700000000000;
  var t = startMs;
  var x = 100, y = 100;
  var totalMoves = durationSec * mousemoveRate;
  for (var i = 0; i < totalMoves; i++) {
    x += (rng() - 0.5) * 30 + (rng() < 0.05 ? (rng() - 0.5) * 200 : 0);
    y += (rng() - 0.5) * 30 + (rng() < 0.05 ? (rng() - 0.5) * 200 : 0);
    events.push({ type: 'mm', t: t, x: Math.round(x), y: Math.round(y) });
    t += 50 + Math.floor(rng() * 200) + (rng() < 0.1 ? Math.floor(rng() * 600) : 0);
  }
  var ksStart = startMs + Math.floor(durationSec * 1000 * 0.6);
  var kt = ksStart;
  for (var k = 0; k < keystrokes; k++) {
    var cls = ['letter', 'letter', 'letter', 'letter', 'space', 'punct', 'backspace'][k % 7];
    events.push({ type: 'kd', t: kt, c: cls });
    var fast = rng() < 0.6;
    kt += fast ? (50 + Math.floor(rng() * 50)) : (200 + Math.floor(rng() * 250));
  }
  for (var c = 0; c < 8; c++) {
    events.push({ type: 'click', t: startMs + c * Math.floor(durationSec * 1000 / 8), x: 200, y: 200 });
  }
  events.sort(function (a, b) { return a.t - b.t; });
  return {
    version: 'event-log-v1',
    started_at: startMs,
    duration_ms: durationSec * 1000,
    events_recorded: events.length,
    events: events
  };
}

// Box–Muller Gaussian.
function gauss(rng) {
  var u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Jitter a base log with pure mechanical Gaussian noise.
 *
 *   tSigmaMs    — stddev of per-event timestamp wobble (ms)
 *   coordSigma  — stddev of per-coordinate wobble (px)
 *   countJitter — +/- random count of dropped trailing mm events
 *                  (changes event_density + total distance + duration)
 *
 * Timestamps are re-sorted and floored to ints. Duration_ms is recomputed
 * from the actual event span so duration_match stays honest (the attacker
 * ships a self-consistent log — the cheap, obvious move).
 */
function jitterLog(base, rng, tSigmaMs, coordSigma, countJitter) {
  var evs = [];
  for (var i = 0; i < base.events.length; i++) {
    var e = base.events[i];
    var ne = { type: e.type };
    ne.t = Math.round(e.t + gauss(rng) * tSigmaMs);
    if (e.x !== undefined) ne.x = Math.round(e.x + gauss(rng) * coordSigma);
    if (e.y !== undefined) ne.y = Math.round(e.y + gauss(rng) * coordSigma);
    if (e.c !== undefined) ne.c = e.c;
    evs.push(ne);
  }
  // Optional small count perturbation: drop up to countJitter trailing
  // mousemoves (mechanical — no new human motion synthesized).
  if (countJitter > 0) {
    var drop = Math.floor(rng() * (countJitter + 1));
    for (var d = 0; d < drop; d++) {
      for (var j = evs.length - 1; j >= 0; j--) {
        if (evs[j].type === 'mm') { evs.splice(j, 1); break; }
      }
    }
  }
  evs.sort(function (a, b) { return a.t - b.t; });
  var span = evs[evs.length - 1].t - evs[0].t;
  return {
    version: 'event-log-v1',
    started_at: evs[0].t,
    duration_ms: span,
    events_recorded: evs.length,
    events: evs
  };
}

// ─────────────────────────────────────────────────────────────────────
// Experiment
// ─────────────────────────────────────────────────────────────────────
var N = 1000;
var base = buildHumanLikeLog({ durationSec: 180, mousemoveRate: 4, keystrokes: 60, seed: 42 });

// The attacker claims a FIXED session duration on every replay (the
// recorded human's real 180s). runWall calls BOTH featureFingerprint and
// serverRecompute with sessionMeta.durationSec — the CLAIMED value, NOT
// the recomputed event span. We model that exactly: CLAIMED_DUR is constant
// across all replays. (An earlier version of this PoC re-derived duration
// from each replay's event span; that mismatched the base fingerprint's
// durBucket/densityBucket and produced a FALSE "0% collision at exact
// replay" — corrected here to faithfully mirror runWall lines 501/512.)
var CLAIMED_DUR = 180;
var CLAIMED_COMPOSITE = 0.65;

// Sanity: confirm the base trace is genuinely a "clean" receipt under the
// REAL recompute. The attacker's recorded human trace must itself pass.
var baseDurSec = base.duration_ms / 1000;
var baseRec = scorer.serverRecompute(base, CLAIMED_COMPOSITE, CLAIMED_DUR, 'authored');
var baseFp = scorer.featureFingerprint(base, CLAIMED_DUR);

console.log('=== BASE TRACE SANITY (the one recorded human log) ===');
console.log('  events:            ' + base.events.length);
console.log('  base duration_ms:  ' + base.duration_ms + '  (' + baseDurSec.toFixed(1) + 's)');
console.log('  serverRecompute ok:        ' + baseRec.ok);
console.log('  server_composite:          ' + baseRec.server_composite +
            '  (client claims 0.65)');
console.log('  divergent:                 ' + baseRec.divergent +
            '  (threshold ' + baseRec.threshold + ')');
console.log('  base fingerprint:          ' + baseFp);
console.log('');

// Jitter sweep. Each row is a "noise level" the attacker dials in.
// tSigmaMs: timestamp wobble. coordSigma: coordinate wobble. countJitter:
// trailing-mm drop count. Levels go from "barely perturbed" up.
var levels = [
  { name: 'L0  none (exact replay)',        tSigmaMs: 0,    coordSigma: 0,   countJitter: 0 },
  { name: 'L1  tiny    (t=2ms,xy=1px)',     tSigmaMs: 2,    coordSigma: 1,   countJitter: 0 },
  { name: 'L2  small   (t=10ms,xy=3px)',    tSigmaMs: 10,   coordSigma: 3,   countJitter: 0 },
  { name: 'L3  modest  (t=25ms,xy=5px)',    tSigmaMs: 25,   coordSigma: 5,   countJitter: 0 },
  { name: 'L4  +count  (t=25ms,xy=5,c=8)',  tSigmaMs: 25,   coordSigma: 5,   countJitter: 8 },
  { name: 'L5  med     (t=60ms,xy=12,c=20)',tSigmaMs: 60,   coordSigma: 12,  countJitter: 20 },
  { name: 'L6  large   (t=150ms,xy=30,c=60)',tSigmaMs: 150, coordSigma: 30,  countJitter: 60 },
  { name: 'L7  heavy   (t=400ms,xy=80,c=150)',tSigmaMs: 400,coordSigma: 80,  countJitter: 150 }
];

console.log('=== JITTER SWEEP (N=' + N + ' replays per level) ===');
console.log('');
console.log('level                          | fp-collide% | recompute-clean% | BOTH-evade%(<-attacker win) | mean|div| | uniqFP');
console.log('-------------------------------+-------------+------------------+-----------------------------+-----------+-------');

var rng = seededRng(0xBADC0DE);
var results = [];

for (var L = 0; L < levels.length; L++) {
  var lv = levels[L];
  var collide = 0;        // fingerprint == base fingerprint  (CAUGHT by fp2)
  var cleanPass = 0;      // serverRecompute ok && !divergent  (receipt clean)
  var bothEvade = 0;      // fp differs AND recompute clean     (ATTACKER WIN)
  var divSum = 0;
  var uniq = {};
  for (var n = 0; n < N; n++) {
    var jl = jitterLog(base, rng, lv.tSigmaMs, lv.coordSigma, lv.countJitter);
    // Faithful to runWall: BOTH calls use the CLAIMED duration (constant
    // across replays — the attacker keeps claiming the recorded 180s),
    // NOT the jittered event span. claimed verdict 'authored', claimed
    // composite 0.65 (== the recorded human's real client composite, so
    // no over-claim; the one-sided divergence test is maximally
    // favorable to the attacker).
    var fp = scorer.featureFingerprint(jl, CLAIMED_DUR);
    uniq[fp] = 1;
    var rec = scorer.serverRecompute(jl, CLAIMED_COMPOSITE, CLAIMED_DUR, 'authored');
    var fpHit = (fp === baseFp);
    var clean = rec.ok && !rec.divergent;
    if (fpHit) collide++;
    if (clean) cleanPass++;
    if (!fpHit && clean) bothEvade++;
    divSum += rec.ok ? rec.divergence : 1.0;
  }
  var collidePct = (collide / N) * 100;
  var cleanPct = (cleanPass / N) * 100;
  var evadePct = (bothEvade / N) * 100;
  var meanDiv = divSum / N;
  results.push({
    name: lv.name, collidePct: collidePct, cleanPct: cleanPct,
    evadePct: evadePct, meanDiv: meanDiv, uniq: Object.keys(uniq).length
  });
  console.log(
    lv.name.padEnd(30) + ' | ' +
    (collidePct.toFixed(1) + '%').padStart(11) + ' | ' +
    (cleanPct.toFixed(1) + '%').padStart(16) + ' | ' +
    (evadePct.toFixed(1) + '%').padStart(27) + ' | ' +
    meanDiv.toFixed(3).padStart(9) + ' | ' +
    String(Object.keys(uniq).length).padStart(6)
  );
}

console.log('');
console.log('=== INTERPRETATION ===');
console.log('  fp-collide%   : replays whose fp2 == base fp2 (trace_novelty_low fires → CAUGHT).');
console.log('  recompute-clean% : replays serverRecompute returns ok && !divergent (receipt mints clean).');
console.log('  BOTH-evade%   : fp differs AND recompute clean → one minted clean receipt that fp2 did NOT catch.');
console.log('');

// Find cheapest level meeting the pre-registered bar: <5% collide AND
// the replay still mints clean.
var win = null;
for (var r = 1; r < results.length; r++) {  // skip L0 exact-replay
  if (results[r].collidePct < 5 && results[r].cleanPct > 50) { win = results[r]; break; }
}

if (win) {
  console.log('  CHEAPEST EVADING CONFIG: ' + win.name.trim());
  console.log('    fp-collide ' + win.collidePct.toFixed(1) + '%  (< 5% bar MET)');
  console.log('    recompute-clean ' + win.cleanPct.toFixed(1) + '%  (receipts still mint clean)');
  console.log('    => one recorded human trace + pure mechanical noise mints');
  console.log('       ~' + win.cleanPct.toFixed(0) + ' clean receipts per 100 replays, fp2 catching only '
              + win.collidePct.toFixed(1) + '%.');
} else {
  console.log('  No level met <5% collide AND >50% clean → fp2 + recompute HELD under this attack.');
}
