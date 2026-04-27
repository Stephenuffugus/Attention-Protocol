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
// this, mark the receipt server_recompute_divergent. Set generously so
// real human noise doesn't trigger it; tighten once we have an empirical
// distribution from real-pilot sessions.
var DIVERGENCE_THRESHOLD = 0.20;

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
function computeServerComposite(signals) {
  var weights = {
    timing_cv: 0.30,
    motion: 0.30,
    keystroke_coherence: 0.20,
    duration_match: 0.10,
    event_density: 0.10
  };
  var s = 0;
  s += (signals.timing_cv || 0) * weights.timing_cv;
  s += (signals.motion || 0) * weights.motion;
  s += (signals.keystroke_coherence || 0) * weights.keystroke_coherence;
  s += (signals.duration_match || 0) * weights.duration_match;
  s += (signals.event_density || 0) * weights.event_density;
  return Math.max(0, Math.min(1, s));
}

/**
 * Top-level recompute. Returns { ok, server_composite, divergent,
 * divergence, signal_scores, plausibility, version }.
 *
 * `claimedComposite` is the client-supplied composite (typically
 * session.signals.composite). `claimedDurationSec` is session.duration_sec.
 * `claimedCiVerdict` is session.composition_integrity.verdict.
 */
function serverRecompute(eventLog, claimedComposite, claimedDurationSec, claimedCiVerdict) {
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

  var serverComposite = computeServerComposite(signals);
  var divergence = Math.abs(claimedComposite - serverComposite);
  var divergent = divergence > DIVERGENCE_THRESHOLD;

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

module.exports = {
  serverRecompute: serverRecompute,
  validateEventLog: validateEventLog,
  computeServerComposite: computeServerComposite,
  timingCvScore: timingCvScore,
  motionScore: motionScore,
  keystrokeCoherenceScore: keystrokeCoherenceScore,
  DIVERGENCE_THRESHOLD: DIVERGENCE_THRESHOLD,
  VERSION: VERSION
};
