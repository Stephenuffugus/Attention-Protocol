/**
 * SWS Attention Protocol — Server-Side Composite Recompute
 *
 * R2-NEW-2 / "THE WALL" — server-side recompute of the behavioral
 * composite from a privacy-safe raw-event log shipped by the SDK.
 *
 * This module is the canonical defense the round-2/3/4 adversarial-bot-
 * builder agent has named through three rounds of hostile review:
 * without it, an attacker forges `signals.composite=0.95` directly to
 * Firestore and the trigger signs it. With it, the server recomputes
 * key signals from the raw events and rejects receipts where the
 * client-claimed composite diverges from the server-recomputed value
 * by more than a threshold (default 0.20).
 *
 * Scope of this MVP — recomputes a SUBSET of high-weight SDK signals
 * (timing CV, motion plausibility, keystroke-vs-paste coherence,
 * scroll-rate plausibility, click-rate plausibility, session duration).
 * Full-signal parity with src/sdk/attention-protocol.js#computeHumanConfidence
 * is the next iteration; the MVP is sufficient to force any attacker to
 * ALSO ship a coherent event log — round-4 bot-builder agent estimated
 * this raises bypass cost from $50/mo + 56h to $5-20k/mo + 200-400h.
 *
 * Forbidden: this module must NOT make any inference about the user
 * beyond what the events themselves declare. No DOM lookups, no
 * heuristic classification of mousemove targets, no keystroke-content
 * inference. The event log is the input; the score is the output.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

var VERSION = 'server-scorer-v1';

// Divergence threshold: if |client_composite - server_composite| exceeds
// this, mark the receipt server_recompute_divergent.
//
// Round-5 calibration concern: the MVP scorer uses 5 signals while the
// client uses 20+. A real human with a desktop session that's 80%
// reading + 15% click + 5% type lands client≈0.65, server≈0.40 (motion
// signal=low, keystroke signal=low because few keys, density=low) →
// divergence 0.25. The previous 0.20 threshold caught this as a false-
// positive divergent. Widened to 0.30 until empirical-pilot baseline
// data establishes the real human-noise distribution.
//
// Long-term: shift to a percentile-of-baseline test or a relative-
// divergence metric (delta / max(client, server)) bounded by signal-
// coverage gap rather than absolute composite delta. Tracked in
// HARDENING_PLAN under R5-NEW-9.
var DIVERGENCE_THRESHOLD = 0.30;

// Plausibility bands from human-typing literature:
//   Inter-event CV (timing variability): humans land in [0.30, 1.50]
//   Bots tend to either too-uniform (CV < 0.30, mechanical) or
//   too-bursty (CV > 1.50, artificial jitter).
var TIMING_CV_HUMAN_LO = 0.30;
var TIMING_CV_HUMAN_HI = 1.50;

// Reading speed sanity: 50-1200 wpm covers slow careful reading through
// fast skim. Below or above is implausible.
var READING_WPM_LO = 50;
var READING_WPM_HI = 1200;

/**
 * Compute population standard deviation.
 */
function stdev(arr) {
  if (!arr || arr.length < 2) return 0;
  var mean = 0;
  for (var i = 0; i < arr.length; i++) mean += arr[i];
  mean /= arr.length;
  var sq = 0;
  for (var j = 0; j < arr.length; j++) sq += (arr[j] - mean) * (arr[j] - mean);
  return Math.sqrt(sq / arr.length);
}

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

/**
 * Validate the event-log structure before scoring.
 * Returns { valid: bool, reason: string }
 */
function validateEventLog(log) {
  if (!log || typeof log !== 'object') return { valid: false, reason: 'log_missing' };
  if (!Array.isArray(log.events)) return { valid: false, reason: 'events_not_array' };
  if (log.events.length === 0) return { valid: false, reason: 'events_empty' };
  if (typeof log.duration_ms !== 'number' || log.duration_ms < 1000) {
    return { valid: false, reason: 'duration_implausibly_short' };
  }
  if (log.events.length > 50000) {
    return { valid: false, reason: 'events_too_many_50k_cap' };
  }
  // Each event must have type and t.
  for (var i = 0; i < Math.min(log.events.length, 100); i++) {
    var e = log.events[i];
    if (!e || typeof e !== 'object') return { valid: false, reason: 'event_not_object_at_' + i };
    if (typeof e.type !== 'string') return { valid: false, reason: 'event_no_type_at_' + i };
    if (typeof e.t !== 'number') return { valid: false, reason: 'event_no_t_at_' + i };
  }
  return { valid: true, reason: 'ok' };
}

/**
 * Compute timing-CV signal score from inter-event intervals.
 * Score 1.0 = CV in human band; 0.0 = CV at extreme; smooth between.
 */
function timingCvScore(events) {
  if (events.length < 5) return { score: 0, cv: null, n: events.length };
  var intervals = [];
  for (var i = 1; i < events.length; i++) {
    var dt = events[i].t - events[i - 1].t;
    if (dt > 0 && dt < 30000) intervals.push(dt); // exclude long pauses (>30s)
  }
  if (intervals.length < 4) return { score: 0, cv: null, n: intervals.length };
  var m = mean(intervals);
  var s = stdev(intervals);
  if (m === 0) return { score: 0, cv: null, n: intervals.length };
  var cv = s / m;
  // Score: 1.0 if CV in [0.30, 1.50]; tapers linearly to 0 at CV=0 or CV=3.0.
  var score;
  if (cv >= TIMING_CV_HUMAN_LO && cv <= TIMING_CV_HUMAN_HI) score = 1.0;
  else if (cv < TIMING_CV_HUMAN_LO) score = Math.max(0, cv / TIMING_CV_HUMAN_LO);
  else score = Math.max(0, 1 - (cv - TIMING_CV_HUMAN_HI) / 1.5);
  // Cap timing-CV score when we have very few intervals — a 4-interval
  // session can produce any CV by luck. Real human sessions have 100+
  // events/intervals.
  if (intervals.length < 10) score = Math.min(score, 0.5);
  if (intervals.length < 20) score = Math.min(score, 0.7);
  return { score: score, cv: cv, n: intervals.length };
}

/**
 * Motion-plausibility score: did the user actually move the mouse?
 * 1.0 = plenty of motion + variable speed. 0.0 = no motion (desktop bot
 * that just clicks). N/A on touch (mobile reweight handled elsewhere).
 *
 * Note: a determined attacker can ship motion via page.mouse.move; this
 * signal alone doesn't catch them. But it does catch the trivial case
 * where someone POSTs composite=0.95 with no motion events.
 */
function motionScore(events) {
  var moves = events.filter(function(e) { return e.type === 'mm'; });
  if (moves.length === 0) return { score: 0, total_distance: 0, segments: 0, reason: 'no_motion' };
  if (moves.length < 5) return { score: 0.1, total_distance: 0, segments: moves.length, reason: 'too_few_segments' };
  var totalDist = 0;
  var speedSamples = [];
  for (var i = 1; i < moves.length; i++) {
    var dx = moves[i].x - moves[i - 1].x;
    var dy = moves[i].y - moves[i - 1].y;
    var dt = moves[i].t - moves[i - 1].t;
    var d = Math.sqrt(dx * dx + dy * dy);
    totalDist += d;
    if (dt > 0 && dt < 5000) speedSamples.push(d / dt);
  }
  // Plausibility:
  // - total distance > 100px (any session involves SOME motion)
  // - speed CV > 0.3 (humans don't move at constant velocity)
  if (totalDist < 100) return { score: 0.2, total_distance: totalDist, segments: moves.length, reason: 'too_little_distance' };
  var speedM = mean(speedSamples);
  var speedSD = stdev(speedSamples);
  var speedCV = speedM > 0 ? speedSD / speedM : 0;
  var score = 0;
  if (speedCV >= 0.3) score = 0.8;
  if (speedCV >= 0.5) score = 1.0;
  if (totalDist > 1000) score = Math.min(1.0, score + 0.1);
  return {
    score: score,
    total_distance: Math.round(totalDist),
    segments: moves.length,
    speed_cv: Number(speedCV.toFixed(3))
  };
}

/**
 * Keystroke-vs-paste coherence. The receipt's composition_integrity
 * verdict declares 'authored' / 'pasted' / 'mechanical' / 'suspicious'.
 * The event log should agree:
 *   - 'authored' → many keydown events, distributed timing
 *   - 'pasted' → few/no keydown events, especially around the
 *     reflection submission window
 *   - 'mechanical' → keydowns with very low CV
 *
 * We check: does the keydown count match the claimed verdict?
 */
function keystrokeCoherenceScore(events, claimedVerdict) {
  var keystrokes = events.filter(function(e) { return e.type === 'kd'; });
  var n = keystrokes.length;
  if (claimedVerdict === 'authored' && n < 10) {
    return { score: 0, n: n, verdict_claimed: claimedVerdict, reason: 'authored_but_too_few_keystrokes' };
  }
  if (claimedVerdict === 'pasted' && n > 100) {
    return { score: 0, n: n, verdict_claimed: claimedVerdict, reason: 'pasted_but_many_keystrokes' };
  }
  if (n < 2) return { score: claimedVerdict === 'pasted' ? 1 : 0, n: n, verdict_claimed: claimedVerdict };
  // CV check
  var intervals = [];
  for (var i = 1; i < keystrokes.length; i++) {
    var dt = keystrokes[i].t - keystrokes[i - 1].t;
    if (dt > 0 && dt < 5000) intervals.push(dt);
  }
  if (intervals.length < 3) return { score: 0.5, n: n, verdict_claimed: claimedVerdict, reason: 'few_intervals' };
  var m = mean(intervals);
  var s = stdev(intervals);
  var cv = m > 0 ? s / m : 0;
  // 'authored' should have CV >= 0.30
  if (claimedVerdict === 'authored' && cv < 0.20) {
    return { score: 0.1, n: n, verdict_claimed: claimedVerdict, cv: Number(cv.toFixed(3)), reason: 'authored_cv_too_low_mechanical' };
  }
  if (claimedVerdict === 'mechanical' && cv > 0.50) {
    return { score: 0.3, n: n, verdict_claimed: claimedVerdict, cv: Number(cv.toFixed(3)), reason: 'mechanical_cv_too_high' };
  }
  return { score: 1.0, n: n, verdict_claimed: claimedVerdict, cv: Number(cv.toFixed(3)) };
}

/**
 * Compose a server-side composite from the per-signal scores using
 * weights that sum to 1.0. Weights are chosen to reflect the SDK's
 * relative weighting where applicable. NOT the same numeric value the
 * client computes (the client has 20+ signals, the server has ~5), but
 * a SCORE that should track the client's composite for legitimate
 * sessions.
 */
function computeServerComposite(signals, motionApplicable) {
  // Round-5 R5-NEW-10: when motion is N/A for the device (mobile touch,
  // keyboard-only accessibility users, headless without mouse), the
  // 0.30 motion weight redistributes onto keystroke + density. Mirrors
  // the SDK's mobile-reweight pattern (4 mouse-only signals read 0 on
  // touch and the composite is reweighted across the remaining 19).
  // motionApplicable defaults true when omitted (legacy behavior).
  var weights;
  if (motionApplicable === false) {
    weights = {
      timing_cv: 0.30,
      motion: 0.0,
      keystroke_coherence: 0.40,  // +0.20
      duration_match: 0.10,
      event_density: 0.20         // +0.10
    };
  } else {
    weights = {
      timing_cv: 0.30,
      motion: 0.30,
      keystroke_coherence: 0.20,
      duration_match: 0.10,
      event_density: 0.10
    };
  }
  var s = 0;
  s += (signals.timing_cv || 0) * weights.timing_cv;
  s += (signals.motion || 0) * weights.motion;
  s += (signals.keystroke_coherence || 0) * weights.keystroke_coherence;
  s += (signals.duration_match || 0) * weights.duration_match;
  s += (signals.event_density || 0) * weights.event_density;
  var raw = Math.max(0, Math.min(1, s));
  // R9-STOPGAP-1 (tourniquet, not surgery): cap server_composite on the
  // no-motion redistribution branch. Round 9 vec3 case F demonstrated
  // that a 150-event synthetic-keyboard log (no human required) reaches
  // server_composite=0.84 here via the 0.40/0.20/0.10 reweight. Hard
  // cap so any "I have no motion" path is structurally barred from the
  // server_attested tier (which post-STOPGAP-2 requires >=0.75).
  // NOT a fix for the root cause: plausibility != provenance.
  if (motionApplicable === false) raw = Math.min(raw, 0.65);
  return raw;
}

/**
 * Top-level recompute. Returns { ok, server_composite, divergent,
 * divergence, signal_scores, plausibility, version }.
 *
 * `claimedComposite` is the client-supplied composite (typically
 * session.signals.composite). `claimedDurationSec` is session.duration_sec.
 * `claimedCiVerdict` is session.composition_integrity.verdict.
 */
function serverRecompute(eventLog, claimedComposite, claimedDurationSec, claimedCiVerdict, opts) {
  opts = opts || {};
  var validation = validateEventLog(eventLog);
  if (!validation.valid) {
    return {
      ok: false,
      reason: validation.reason,
      server_composite: 0,
      divergent: true,
      divergence: 1.0,
      version: VERSION
    };
  }

  var events = eventLog.events;

  // Sub-scores
  var timing = timingCvScore(events);
  var motion = motionScore(events);
  var keystroke = keystrokeCoherenceScore(events, claimedCiVerdict);

  // Duration-match: does the log's duration align with session.duration_sec?
  var logDurationSec = eventLog.duration_ms / 1000;
  var durationDelta = Math.abs(logDurationSec - claimedDurationSec);
  var durationMatchScore;
  if (claimedDurationSec === 0) durationMatchScore = 0.5;
  else if (durationDelta / claimedDurationSec < 0.10) durationMatchScore = 1.0;
  else if (durationDelta / claimedDurationSec < 0.25) durationMatchScore = 0.7;
  else durationMatchScore = 0.2;

  // Event-density: humans produce roughly 5-30 events/sec on average
  // (mousemoves dominate). < 0.5/sec is suspiciously low; > 100/sec is
  // implausibly high. Round-4 tightening: <2/sec is now strongly
  // suspicious for any active session (the lazy paste-bot with 5
  // events over 5s = 1/sec was previously getting 0.5 credit; now 0.2).
  var eventsPerSec = logDurationSec > 0 ? events.length / logDurationSec : 0;
  var eventDensityScore;
  if (eventsPerSec < 0.5 || eventsPerSec > 100) eventDensityScore = 0.1;
  else if (eventsPerSec < 2) eventDensityScore = 0.2;
  else if (eventsPerSec > 50) eventDensityScore = 0.5;
  else eventDensityScore = 1.0;

  var signals = {
    timing_cv: timing.score,
    motion: motion.score,
    keystroke_coherence: keystroke.score,
    duration_match: durationMatchScore,
    event_density: eventDensityScore
  };

  // Round-5 R5-NEW-10 + Round-6 R6-NEW-6: detect "motion not applicable"
  // so we don't false-flag keyboard-only / accessibility / mobile / pure-
  // reading users. Two cases qualify:
  //   (a) keyboard-only: motion absent + ≥10 keystrokes
  //   (b) pure-reading (round-6 add): motion absent + keystrokes absent
  //       + ≥20 scroll events (e.g., long-form reading on a trackpad
  //       with momentum scroll, or a page where the user only scrolls).
  var scrollCount = events.filter(function(e) { return e.type === 'scroll'; }).length;
  var autoMotionApplicable = !(
    motion.reason === 'no_motion' &&
    (keystroke.n >= 10 || (keystroke.n === 0 && scrollCount >= 20))
  );
  // R9-STOPGAP-3 (tourniquet): runWall passes opts.allowMotionFlip=false
  // when the session document did not declare a device class authorising
  // no-motion operation (mobile/touch/keyboard-only/no-pointer). Without
  // an explicit declaration we refuse to redistribute the 0.30 motion
  // weight, so motion=0 zeroes that slice of the score. Direct callers
  // (the existing serverRecompute unit tests) omit opts and preserve the
  // pre-stopgap auto-detect behaviour.
  // Honest gap: an attacker can lie about the device class to flip this
  // — STOPGAP-1's cap is the layered defense; STOPGAP-2's tier gate is
  // the third layer. None of these closes the root cause.
  var motionApplicable;
  if (opts.allowMotionFlip === false) motionApplicable = true;
  else motionApplicable = autoMotionApplicable;
  var serverComposite = computeServerComposite(signals, motionApplicable);
  // Round-5 R5-NEW-10b: divergent is ONE-SIDED — fires only when the
  // client OVER-claims relative to the server. The reverse case
  // (server > client + threshold) means the server was MORE lenient
  // (e.g., a keyboard-only session where the client tanked the score
  // because of missing motor signals; the server-side redistribution
  // gave it credit). That's fine; not an attack vector.
  // Absolute |delta| is still reported for forensic value.
  var divergence = Math.abs(claimedComposite - serverComposite);
  var divergent = (claimedComposite - serverComposite) > DIVERGENCE_THRESHOLD;

  return {
    ok: true,
    server_composite: Number(serverComposite.toFixed(3)),
    client_composite: claimedComposite,
    divergence: Number(divergence.toFixed(3)),
    divergent: divergent,
    threshold: DIVERGENCE_THRESHOLD,
    signal_scores: signals,
    signal_details: {
      timing: timing,
      motion: motion,
      keystroke: keystroke,
      duration_log_sec: Number(logDurationSec.toFixed(1)),
      duration_session_sec: claimedDurationSec,
      events_per_sec: Number(eventsPerSec.toFixed(2)),
      event_count: events.length
    },
    version: VERSION
  };
}

/**
 * R2-NEW-2b / TRACE-NOVELTY MVP — feature-fingerprint of an event log.
 *
 * The wall (R2-NEW-2) catches a bot that fakes a composite without
 * shipping a coherent event log. The next bypass is to record real
 * human event logs (e.g., $5/trace via Mechanical Turk, 10 traces =
 * $50) and REPLAY them with small jitter. The replay passes the wall
 * because the events ARE genuinely human-generated.
 *
 * Trace-novelty defense: produce a quantized fingerprint of the
 * session's statistical profile. Two replays of the same recorded
 * trace (with small Gaussian jitter) collapse to the same fingerprint
 * bucket; two genuine independent human sessions diverge. If a new
 * session's fingerprint matches a recent fingerprint from a DIFFERENT
 * uid in the last lookback window, flag as trace_novelty_low.
 *
 * Quantization buckets are deliberately coarse:
 *   timing_cv     → bucket 0-9 (cv*10 floored, capped at 9)
 *   motion_dist   → bucket 0-9 (log10(distance+1) floored, capped at 9)
 *   keystroke_n   → bucket 0-9 (log10(n+1) floored, capped at 9)
 *   duration_sec  → bucket 0-9 (log10(s+1) floored, capped at 9)
 *   event_density → 0-99 (events_per_sec * 2, capped at 99)
 *
 * Empirical validation finding (tests/wall-empirical-validation.test.js):
 * the original 0-9 per-bucket scheme yielded only ~100 unique
 * fingerprints across 1000 varied synthetic human sessions — a 5.7%
 * largest-cluster rate. In production with ~50 sessions/hour lookback,
 * that meant ~5-50% of legitimate users would falsely match a recent
 * session from another uid → trust_tier dropped to bounds_violated.
 *
 * Now (fp v2): each dimension has 100 buckets → 10^10 ≈ 10 billion
 * effective cells. Real-world variation should produce >90% unique
 * fingerprints across legitimate sessions; exact replays still
 * collide (the whole point of the check). Detector string bumped to
 * 'fp2' so a future verifier can distinguish v1 (coarse, vulnerable
 * to false-positive) from v2 (production-tight).
 *
 * NOTE: bucket boundaries still need real-pilot calibration — see
 * R5-NEW-9 / R7-NEW-cal-debt in HARDENING_PLAN. The values below are
 * the best honest defaults given current synthetic data. Pilot
 * sessions will reveal whether bucket-noise-floor matches actual
 * session-to-session variance for the SAME source (replay collision)
 * vs DIFFERENT sources (legitimate diversity).
 */
function featureFingerprint(eventLog, claimedDurationSec) {
  if (!eventLog || !Array.isArray(eventLog.events) || eventLog.events.length === 0) {
    return null;
  }
  var events = eventLog.events;

  // timing_cv bucket — finer (cv * 50, range 0-99 covers cv 0.0-2.0).
  var intervals = [];
  for (var i = 1; i < events.length; i++) {
    var dt = events[i].t - events[i - 1].t;
    if (dt > 0 && dt < 30000) intervals.push(dt);
  }
  var cvBucket = 0;
  if (intervals.length >= 4) {
    var m = mean(intervals), s = stdev(intervals);
    var cv = m > 0 ? s / m : 0;
    cvBucket = Math.min(99, Math.floor(cv * 50));
  }

  // motion_distance bucket — log10 * 15 covers 1 to 1B with finer steps.
  var moves = events.filter(function(e) { return e.type === 'mm'; });
  var totalDist = 0;
  for (var j = 1; j < moves.length; j++) {
    var dx = moves[j].x - moves[j - 1].x;
    var dy = moves[j].y - moves[j - 1].y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
  }
  var distBucket = Math.min(99, Math.floor(Math.log10(totalDist + 1) * 15));

  // keystroke_count bucket — log10 * 30 covers 0 to ~1k typical keystrokes
  // with ~30 buckets in the realistic range.
  var keystrokes = events.filter(function(e) { return e.type === 'kd'; }).length;
  var ksBucket = Math.min(99, Math.floor(Math.log10(keystrokes + 1) * 30));

  // duration_sec bucket — log10 * 30 covers 1s-3hr.
  var dur = claimedDurationSec || (eventLog.duration_ms / 1000);
  var durBucket = Math.min(99, Math.floor(Math.log10(dur + 1) * 30));

  // event_density bucket — events_per_sec * 2; covers 0-50 events/sec.
  var density = dur > 0 ? events.length / dur : 0;
  var densityBucket = Math.min(99, Math.floor(density * 2));

  return 'fp2:' + cvBucket + ':' + distBucket + ':' + ksBucket + ':' + durBucket + ':' + densityBucket;
}

/**
 * Round-6 R6-NEW-1+5 fix: extract a single shared runner so BOTH
 * signing paths (HTTP signReceipt + Firestore-trigger onSessionWritten)
 * use identical wall logic. Round-5's HTTP-path fix duplicated the
 * plausibility-bounds + recompute + trustTier resolution inline,
 * which round-6 caught as drift bait — the two paths read different
 * field names (duration_ms vs duration_sec, interaction_count vs
 * hashes_earned) and resolved trustTier as two parallel if-else trees.
 * Now: one helper, both callers normalize via the same field-extractor.
 *
 * @param {Object} sessionMeta - normalised session view (already extracted)
 *   { composite, durationSec, ciVerdict, environmental, interactions, eventLog, uid, sessionId }
 * @param {Object} ctx - { admin: optional FirebaseAdmin for trace-novelty Firestore queries }
 *   When admin is supplied, trace-novelty runs against the
 *   `session_fingerprints` collection. When omitted (legacy / non-trigger
 *   contexts), only the local fingerprint is computed and the match
 *   query is reported as `checked: false, reason: 'no_admin_context'`.
 *
 * Returns: {
 *   trustTier, boundsViolations, serverRecompute, traceNovelty,
 *   walledOutcome (pre-shaped for buildCredential)
 * }
 */
async function runWall(sessionMeta, ctx) {
  ctx = ctx || {};
  var composite = sessionMeta.composite;
  var durationSec = sessionMeta.durationSec || 0;
  var ciVerdict = sessionMeta.ciVerdict;
  var env = sessionMeta.environmental;
  var envClean = env && env.loaded === true && env.bot !== true;
  var ciAuthored = ciVerdict === 'authored';
  var interactions = sessionMeta.interactions || 0;

  // Round-6 R6-NEW-4: bounds use >= not > so composite=0.85 exactly is
  // also constrained. Off-by-one previously let an attacker post
  // composite=0.85 to skip all high-composite checks.
  var boundsViolations = [];
  if (composite >= 0.85) {
    if (!envClean) boundsViolations.push('high_composite_without_clean_env');
    if (!ciAuthored) boundsViolations.push('high_composite_without_authored_ci');
    if (durationSec < 60) boundsViolations.push('high_composite_short_session_' + durationSec + 's');
    if (interactions < 5) boundsViolations.push('high_composite_low_interaction_' + interactions);
  } else if (composite >= 0.50) {
    if (durationSec < 30) boundsViolations.push('mid_composite_short_session_' + durationSec + 's');
  }

  var serverRecomputeResult = { ok: false, reason: 'event_log_absent' };
  var traceNovelty = { checked: false };

  // R9-STOPGAP-3 (tourniquet): only allow the motionApplicable=false
  // redistribution when the session explicitly declares a device class
  // that justifies no-motion operation. SDK fields we accept as a
  // declaration: environmental.device_class, environmental.touch_only,
  // environmental.input_mode, environmental.pointer_type. If none of
  // these is present, no auto-flip — motion=0 zeroes the motion weight
  // and a synthetic-keyboard-only event log (round9 vec3 case F) can no
  // longer recompute to a high score.
  var deviceClassDeclared = !!(env && (
    env.device_class ||
    env.touch_only === true ||
    env.input_mode === 'keyboard' ||
    env.input_mode === 'touch' ||
    env.pointer_type === 'none' ||
    env.pointer_type === 'touch'
  ));

  if (sessionMeta.eventLog) {
    serverRecomputeResult = serverRecompute(
      sessionMeta.eventLog, composite, durationSec, ciVerdict,
      { allowMotionFlip: deviceClassDeclared });
    if (!serverRecomputeResult.ok) {
      boundsViolations.push('server_recompute_failed:' + serverRecomputeResult.reason);
    } else if (serverRecomputeResult.divergent) {
      boundsViolations.push('server_recompute_divergent:client=' +
        serverRecomputeResult.client_composite + ',server=' +
        serverRecomputeResult.server_composite);
    }

    // R2-NEW-2b trace-novelty
    var fingerprint = featureFingerprint(sessionMeta.eventLog, durationSec);
    if (fingerprint) {
      if (ctx.admin) {
        try {
          var oneHourAgo = ctx.admin.firestore.Timestamp.fromMillis(
            Date.now() - 60 * 60 * 1000);
          var matchSnap = await ctx.admin.firestore()
            .collection('session_fingerprints')
            .where('fingerprint', '==', fingerprint)
            .where('signed_at', '>=', oneHourAgo)
            .limit(10)
            .get();
          var matches = matchSnap.docs.filter(function(d) {
            return d.data().uid !== sessionMeta.uid;
          });
          traceNovelty = {
            checked: true,
            fingerprint: fingerprint,
            recent_matches_other_uid: matches.length,
            suspicious: matches.length >= 1
          };
          if (matches.length >= 1) {
            boundsViolations.push('trace_novelty_low:' + matches.length +
              '_other_uid_in_last_hour');
          }
          await ctx.admin.firestore()
            .collection('session_fingerprints')
            .add({
              fingerprint: fingerprint,
              uid: sessionMeta.uid,
              session_id: sessionMeta.sessionId,
              signed_at: ctx.admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (tnErr) {
          // Round-6 R6-NEW-3 / R6-NEW-8 fix: explicit reason instead of
          // silent fail-open. The verifier surfaces will treat
          // 'firestore_error' as a non-server_attested condition.
          traceNovelty = { checked: false, reason: 'firestore_error',
                           fingerprint: fingerprint };
          // Surface the failure as a bounds violation so trustTier
          // resolution can downgrade. Without this, an attacker could
          // route through a context where trace-novelty errors silently
          // and pass as server_attested.
          boundsViolations.push('trace_novelty_firestore_error');
        }
      } else {
        // No admin context (HTTP signReceipt before this commit).
        // Round-6 R6-NEW-2 fix: explicit non-server_attested signal.
        // The fingerprint is computed for forensic value but the
        // collection query did not run, so we cannot rule out replay.
        traceNovelty = { checked: false, reason: 'no_admin_context',
                         fingerprint: fingerprint };
        boundsViolations.push('trace_novelty_not_checked');
      }
    }
  } else {
    boundsViolations.push('event_log_absent');
  }

  // Trust-tier resolution — single source of truth, replaces the two
  // parallel if-else trees previously in HTTP + Firestore paths.
  // R9-STOPGAP-2 (tourniquet): require server_composite >= 0.75 for the
  // server_attested tier. Round 9 vec3 cases B/C/D produced clean
  // bounds/non-divergent receipts at server_composite 0.54-0.70 (the
  // 0.30 divergence threshold gave attackers a wide pad); raising the
  // tier bar above that band shuts the easy logic-abuse path. Trade-off
  // documented: legitimate desktop-pointer humans whose recompute lands
  // in [0.65, 0.75] are demoted from server_attested to
  // client_attested_bounds_clean — the receipt still mints, the tier
  // label is honest about what we could actually prove server-side.
  var SERVER_ATTESTED_FLOOR = 0.75;
  var trustTier;
  if (serverRecomputeResult.ok && !serverRecomputeResult.divergent
      && serverRecomputeResult.server_composite >= SERVER_ATTESTED_FLOOR
      && boundsViolations.length === 0) {
    trustTier = 'server_attested';
  } else if (boundsViolations.length === 0) {
    trustTier = 'client_attested_bounds_clean';
  } else if (boundsViolations.length === 1
             && boundsViolations[0] === 'event_log_absent') {
    trustTier = 'client_attested_no_event_log';
  } else if (boundsViolations.length === 1
             && boundsViolations[0] === 'trace_novelty_not_checked') {
    // HTTP path with a clean recompute but no trace-novelty available
    // — softer than bounds_violated but harder than no_event_log.
    trustTier = 'client_attested_no_trace_novelty';
  } else {
    trustTier = 'client_attested_bounds_violated';
  }

  // Round-7 R7-NEW-3 CRITICAL fix: never expose the raw fingerprint
  // bucket value beyond the admin-only Firestore session_fingerprints
  // collection. An attacker who can read the bucket value can probe
  // the response space (~100k buckets) by submitting candidate traces
  // and selecting a bucket with zero recent matches — completely
  // bypassing trace-novelty for ~$5-50 of compute. We surface only
  // the verdict-relevant fields publicly (checked/suspicious/match
  // count); the bucket itself stays admin-only.
  var traceNoveltyPublic = {
    checked: traceNovelty.checked === true,
    suspicious: traceNovelty.suspicious === true,
    recent_matches_other_uid: traceNovelty.recent_matches_other_uid || 0
  };
  if (traceNovelty.reason) traceNoveltyPublic.reason = traceNovelty.reason;

  var walledOutcome = {
    trust_tier: trustTier,
    bounds_violations: boundsViolations,
    server_recompute: serverRecomputeResult.ok ? {
      server_composite: serverRecomputeResult.server_composite,
      divergence: serverRecomputeResult.divergence,
      divergent: serverRecomputeResult.divergent,
      threshold: serverRecomputeResult.threshold,
      version: serverRecomputeResult.version
    } : { ok: false, reason: serverRecomputeResult.reason },
    trace_novelty: traceNoveltyPublic
  };

  return {
    trustTier: trustTier,
    boundsViolations: boundsViolations,
    serverRecomputeResult: serverRecomputeResult,
    traceNovelty: traceNovelty,           // FULL — for admin / Firestore storage
    traceNoveltyPublic: traceNoveltyPublic, // PUBLIC — fingerprint stripped
    walledOutcome: walledOutcome           // PUBLIC subset (used by signing)
  };
}

/**
 * Field-name normaliser (round-6 R6-NEW-1 + R6-NEW-9 fix). HTTP
 * signReceipt and Firestore-trigger onSessionWritten read different
 * shapes; this helper accepts both and produces the canonical
 * sessionMeta that runWall consumes.
 */
function extractSessionMetrics(session) {
  // Round-6 R6-NEW-9: type-coerce numeric fields. Previously
  // `session.interaction_count || 0` short-circuited on `false`/`[]`/
  // `0` to 0 (legit), but a string like "5" passed through and the
  // `< 5` numeric comparison silently coerced. Number() makes the
  // coercion explicit and clamps NaN.
  // Round-7 R7-NEW-5: clamp composite to [0, 1]. The Firestore-trigger
  // path didn't bound-check (only HTTP did at line 222), so a malicious
  // doc with composite=-0.5 or composite=1.5 was passed through as-is.
  // Practical impact was limited (downstream verifiers reject negative
  // composite anyway) but it's unsanitary. Now clamped at extraction.
  var composite = Number(session.composite);
  if (!Number.isFinite(composite)) composite = 0;
  if (composite < 0) composite = 0;
  if (composite > 1) composite = 1;

  // R9-STOPGAP-4: coerce duration_sec/duration_ms via Number() to match
  // the composite + interactions paths above. Pre-stopgap, a string
  // "120" silently dropped to 0 here while composite "0.84" coerced
  // correctly (round9 vec3 case E1). The asymmetry was unsanitary and
  // an easy footgun for downstream callers. Now Number() everywhere;
  // unparseable values still resolve to 0 via the isFinite/positive
  // guards below.
  var durationSec = 0;
  var durSecNum = Number(session.duration_sec);
  var durMsNum = Number(session.duration_ms);
  if (Number.isFinite(durSecNum) && durSecNum > 0) {
    durationSec = durSecNum;
  } else if (Number.isFinite(durMsNum) && durMsNum > 0) {
    durationSec = durMsNum / 1000;
  }

  // Interactions: HTTP path uses `interaction_count`, Firestore path
  // uses `hashes_earned`. Accept either.
  var interactions = Number(
    (session.interaction_count != null ? session.interaction_count : session.hashes_earned)
  );
  if (!Number.isFinite(interactions)) interactions = 0;

  var ciVerdict = session.composition_integrity
    ? session.composition_integrity.verdict
    : null;

  return {
    composite: composite,
    durationSec: durationSec,
    ciVerdict: ciVerdict,
    environmental: session.environmental || null,
    interactions: interactions,
    eventLog: session.event_log || null,
    uid: session.uid || 'anonymous',
    sessionId: session.session_id
  };
}

module.exports = {
  serverRecompute: serverRecompute,
  validateEventLog: validateEventLog,
  computeServerComposite: computeServerComposite,
  timingCvScore: timingCvScore,
  motionScore: motionScore,
  keystrokeCoherenceScore: keystrokeCoherenceScore,
  featureFingerprint: featureFingerprint,
  runWall: runWall,
  extractSessionMetrics: extractSessionMetrics,
  DIVERGENCE_THRESHOLD: DIVERGENCE_THRESHOLD,
  VERSION: VERSION
};
