/**
 * SWS Attention Protocol — Composition Integrity (Signal 21)
 *
 * Detects LLM-assisted cheating: paste bursts from ChatGPT / other LLMs,
 * unnatural absence of backspace corrections, and mechanically uniform
 * keystroke timing.
 *
 * Three detectors run over keyboard/input events on text fields:
 *   1. Paste-burst — >50 chars appear in a single input event OR a
 *      sudden acceleration in chars/sec far beyond human typing speed.
 *   2. Backspace-absence — humans backspace on 5–15% of keystrokes.
 *      Zero backspaces on text >50 chars is a strong signal of paste.
 *   3. Digraph-interval outlier — coefficient of variation (CV) of the
 *      inter-keystroke interval. Humans typically CV 0.4–1.2. Mechanical
 *      typing is near 0. Scripts emulating "jitter" often fall outside.
 *      Also flags sub-60 ms intervals (physically implausible for humans
 *      on the same finger) as a separate component.
 *
 * Research basis: arxiv 2511.12468 (2025), "Detecting LLM-Assisted
 * Academic Dishonesty using Keystroke Dynamics," reports 97–99% F1 on
 * paste-burst + backspace-absence + digraph features.
 *
 * Privacy: this module NEVER records the actual characters typed. Only
 * timing, counts, and event metadata. Aligned with our standing
 * no-content-recorded attestation.
 *
 * Output shape (readSnapshot()):
 *   {
 *     chars_observed, chars_typed, chars_deleted,
 *     paste_burst_detected, paste_burst_count, longest_paste_chars,
 *     backspace_ratio, backspace_suspicious,
 *     digraph_stats: { mean_ms, std_ms, cv, subhuman_interval_count,
 *                      total_intervals },
 *     composition_integrity_score,     // 0–1, higher = more human-authored
 *     composition_verdict,             // authored | pasted | mechanical |
 *                                      // suspicious | unknown
 *     detector: 'sws-composition-v1',
 *     checked_at
 *   }
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // TUNABLE THRESHOLDS (documented; change with recalibration data)
  // ============================================================

  var PASTE_BURST_CHARS = 50;          // >=50 chars in one input event = paste
  var PASTE_BURST_RATE = 50;           // >=50 chars/sec between events = paste
  var SUBHUMAN_INTERVAL_MS = 60;       // <60ms between keys is implausible
  var CV_HUMAN_MIN = 0.30;             // below = too mechanical
  var CV_HUMAN_MAX = 1.20;             // above = too erratic
  var BACKSPACE_MIN_RATIO = 0.02;      // humans usually >=2% backspaces
  var BACKSPACE_MIN_TEXT_LEN = 50;     // below this, can't judge backspace
  var MIN_INTERVALS_FOR_CV = 8;        // below this, CV is unreliable
  var MIN_CHARS_FOR_VERDICT = 20;      // below this, verdict = unknown

  // ============================================================
  // STATE
  // ============================================================

  function createTracker() {
    return {
      attached_at: Date.now(),
      intervals: [],                    // ms between successive keystrokes
      last_keystroke_ts: null,
      chars_typed: 0,                   // printable chars entered via keypress
      chars_deleted: 0,                 // backspace/delete presses
      chars_pasted: 0,                  // chars added via detected paste bursts
      // Input-event tracking (captures paste even without keypress)
      last_input_ts: null,
      last_input_length: 0,
      paste_burst_count: 0,
      longest_paste_chars: 0,
      subhuman_interval_count: 0,
      attached_elements: []             // weakly held for teardown
    };
  }

  var TRACKERS = {};        // scopeId -> tracker
  var DEFAULT_SCOPE = 'default';

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function _onKeydown(scopeId, e) {
    var t = TRACKERS[scopeId];
    if (!t) return;

    var now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    // Classify the key — WITHOUT recording what it was.
    var isBackspace = (e.key === 'Backspace' || e.keyCode === 8 ||
                       e.key === 'Delete' || e.keyCode === 46);
    var isPrintable = (typeof e.key === 'string' && e.key.length === 1);

    if (isBackspace) {
      t.chars_deleted++;
    } else if (isPrintable) {
      t.chars_typed++;
    }

    if (t.last_keystroke_ts !== null) {
      var interval = now - t.last_keystroke_ts;
      if (interval >= 0 && interval < 10000) { // ignore >10s gaps (session pauses)
        t.intervals.push(interval);
        if (interval < SUBHUMAN_INTERVAL_MS) t.subhuman_interval_count++;
      }
    }
    t.last_keystroke_ts = now;
  }

  function _onInput(scopeId, e) {
    var t = TRACKERS[scopeId];
    if (!t) return;

    var now = Date.now();
    var target = e && e.target;
    if (!target) return;
    var newLen = (typeof target.value === 'string') ? target.value.length
                : (typeof target.textContent === 'string') ? target.textContent.length
                : 0;

    // inputType may be 'insertFromPaste', 'deleteContentBackward', etc.
    var inputType = e && e.inputType;
    var delta = newLen - t.last_input_length;

    // Single-event paste detection: a large positive delta in one event.
    if (inputType === 'insertFromPaste' || delta >= PASTE_BURST_CHARS) {
      t.paste_burst_count++;
      t.chars_pasted += Math.max(delta, 0);
      if (delta > t.longest_paste_chars) t.longest_paste_chars = delta;
    }
    // Rate-based paste detection: large delta at high chars/sec.
    else if (delta > 0 && t.last_input_ts !== null) {
      var dtSec = Math.max((now - t.last_input_ts) / 1000, 0.001);
      var rate = delta / dtSec;
      if (delta >= 10 && rate >= PASTE_BURST_RATE) {
        t.paste_burst_count++;
        t.chars_pasted += delta;
        if (delta > t.longest_paste_chars) t.longest_paste_chars = delta;
      }
    }

    t.last_input_ts = now;
    t.last_input_length = newLen;
  }

  // ============================================================
  // ATTACHMENT
  // ============================================================

  /**
   * Start observing a text-input element (or a NodeList of them).
   *
   * @param {Element|NodeList|Array} targets - text inputs to observe
   * @param {Object} [opts]
   * @param {string} [opts.scopeId='default'] - group attribute for multi-form pages
   * @returns {Function} detach function
   */
  function observe(targets, opts) {
    opts = opts || {};
    var scopeId = opts.scopeId || DEFAULT_SCOPE;
    if (!TRACKERS[scopeId]) TRACKERS[scopeId] = createTracker();
    var t = TRACKERS[scopeId];

    var list = _asArray(targets);
    var handlers = [];

    list.forEach(function(el) {
      if (!el || !el.addEventListener) return;
      var kd = function(e) { _onKeydown(scopeId, e); };
      var ip = function(e) { _onInput(scopeId, e); };
      el.addEventListener('keydown', kd, true);
      el.addEventListener('input', ip, true);
      handlers.push({ el: el, kd: kd, ip: ip });
      t.attached_elements.push(el);
    });

    return function detach() {
      handlers.forEach(function(h) {
        h.el.removeEventListener('keydown', h.kd, true);
        h.el.removeEventListener('input', h.ip, true);
      });
    };
  }

  function _asArray(v) {
    if (!v) return [];
    if (v.nodeType) return [v];
    if (typeof v.length === 'number') return Array.prototype.slice.call(v);
    return [v];
  }

  // ============================================================
  // SNAPSHOT / ANALYSIS
  // ============================================================

  /**
   * Compute a snapshot of the current composition-integrity state.
   * @param {Object} [opts]
   * @param {string} [opts.scopeId='default']
   * @returns {Object} snapshot (see module docstring)
   */
  function readSnapshot(opts) {
    opts = opts || {};
    var scopeId = opts.scopeId || DEFAULT_SCOPE;
    var t = TRACKERS[scopeId];
    if (!t) return _emptySnapshot();
    return _analyze(t);
  }

  function _emptySnapshot() {
    return {
      chars_observed: 0,
      chars_typed: 0,
      chars_deleted: 0,
      paste_burst_detected: false,
      paste_burst_count: 0,
      longest_paste_chars: 0,
      backspace_ratio: null,
      backspace_suspicious: false,
      digraph_stats: {
        mean_ms: null, std_ms: null, cv: null,
        subhuman_interval_count: 0, total_intervals: 0
      },
      composition_integrity_score: null,
      composition_verdict: 'unknown',
      detector: 'sws-composition-v1',
      checked_at: new Date().toISOString()
    };
  }

  function _analyze(t) {
    var charsObserved = t.chars_typed + t.chars_deleted + t.chars_pasted;
    var backspaceRatio = charsObserved > 0 ? t.chars_deleted / charsObserved : null;
    var backspaceSuspicious = (t.chars_typed >= BACKSPACE_MIN_TEXT_LEN) &&
                              (backspaceRatio !== null) &&
                              (backspaceRatio < BACKSPACE_MIN_RATIO) &&
                              (t.paste_burst_count === 0);

    var stats = _intervalStats(t.intervals, t.subhuman_interval_count);

    var score = _integrityScore({
      charsObserved: charsObserved,
      pasteBursts: t.paste_burst_count,
      backspaceSuspicious: backspaceSuspicious,
      cv: stats.cv,
      subhumanCount: stats.subhuman_interval_count,
      totalIntervals: stats.total_intervals
    });

    var verdict = _verdict({
      charsObserved: charsObserved,
      pasteBursts: t.paste_burst_count,
      cv: stats.cv,
      totalIntervals: stats.total_intervals,
      score: score
    });

    return {
      chars_observed: charsObserved,
      chars_typed: t.chars_typed,
      chars_deleted: t.chars_deleted,
      chars_pasted: t.chars_pasted,
      paste_burst_detected: t.paste_burst_count > 0,
      paste_burst_count: t.paste_burst_count,
      longest_paste_chars: t.longest_paste_chars,
      backspace_ratio: backspaceRatio,
      backspace_suspicious: backspaceSuspicious,
      digraph_stats: stats,
      composition_integrity_score: score,
      composition_verdict: verdict,
      detector: 'sws-composition-v1',
      checked_at: new Date().toISOString()
    };
  }

  function _intervalStats(intervals, subhumanCount) {
    var n = intervals.length;
    if (n === 0) {
      return { mean_ms: null, std_ms: null, cv: null,
               subhuman_interval_count: subhumanCount || 0, total_intervals: 0 };
    }
    var sum = 0;
    for (var i = 0; i < n; i++) sum += intervals[i];
    var mean = sum / n;
    var sqSum = 0;
    for (var j = 0; j < n; j++) {
      var d = intervals[j] - mean;
      sqSum += d * d;
    }
    var std = Math.sqrt(sqSum / n);
    var cv = mean > 0 ? std / mean : null;
    return {
      mean_ms: Math.round(mean * 100) / 100,
      std_ms: Math.round(std * 100) / 100,
      cv: cv !== null ? Math.round(cv * 1000) / 1000 : null,
      subhuman_interval_count: subhumanCount || 0,
      total_intervals: n
    };
  }

  // ============================================================
  // SCORING
  // ============================================================

  function _integrityScore(f) {
    if (f.charsObserved < MIN_CHARS_FOR_VERDICT) return null;

    var score = 1.0;

    // Paste bursts are the strongest negative signal.
    if (f.pasteBursts > 0) score -= 0.6;
    if (f.pasteBursts >= 3) score -= 0.2;    // multiple pastes = more damning

    // Backspace absence on long text.
    if (f.backspaceSuspicious) score -= 0.2;

    // Digraph CV outside the human band (only if we have enough intervals).
    if (f.cv !== null && f.totalIntervals >= MIN_INTERVALS_FOR_CV) {
      if (f.cv < CV_HUMAN_MIN) score -= 0.25;       // too mechanical
      else if (f.cv > CV_HUMAN_MAX) score -= 0.15;  // suspiciously erratic
    }

    // Physically implausible intervals.
    if (f.totalIntervals > 0) {
      var subhumanRatio = f.subhumanCount / f.totalIntervals;
      if (subhumanRatio >= 0.05) score -= 0.15;
      if (subhumanRatio >= 0.20) score -= 0.15;
    }

    if (score < 0) score = 0;
    if (score > 1) score = 1;
    return Math.round(score * 1000) / 1000;
  }

  function _verdict(f) {
    if (f.charsObserved < MIN_CHARS_FOR_VERDICT) return 'unknown';
    if (f.pasteBursts > 0) return 'pasted';
    if (f.cv !== null && f.totalIntervals >= MIN_INTERVALS_FOR_CV && f.cv < CV_HUMAN_MIN) {
      return 'mechanical';
    }
    if (f.score === null) return 'unknown';
    if (f.score >= 0.75) return 'authored';
    return 'suspicious';
  }

  // ============================================================
  // TEST HELPERS
  // ============================================================

  function _resetForTests() {
    TRACKERS = {};
  }

  function _getTrackerForTests(scopeId) {
    return TRACKERS[scopeId || DEFAULT_SCOPE];
  }

  /**
   * Inject synthetic events for unit tests (bypasses DOM).
   * events: array of { type: 'keydown'|'input', key?, inputType?, valueLen?, ts? }
   */
  function _feedEventsForTests(scopeId, events) {
    scopeId = scopeId || DEFAULT_SCOPE;
    if (!TRACKERS[scopeId]) TRACKERS[scopeId] = createTracker();
    events.forEach(function(ev) {
      if (ev.type === 'keydown') {
        // Replicate _onKeydown without DOM event
        var t = TRACKERS[scopeId];
        var now = typeof ev.ts === 'number' ? ev.ts : Date.now();
        var isBackspace = ev.key === 'Backspace' || ev.key === 'Delete';
        var isPrintable = typeof ev.key === 'string' && ev.key.length === 1;
        if (isBackspace) t.chars_deleted++;
        else if (isPrintable) t.chars_typed++;
        if (t.last_keystroke_ts !== null) {
          var interval = now - t.last_keystroke_ts;
          if (interval >= 0 && interval < 10000) {
            t.intervals.push(interval);
            if (interval < SUBHUMAN_INTERVAL_MS) t.subhuman_interval_count++;
          }
        }
        t.last_keystroke_ts = now;
      } else if (ev.type === 'input') {
        var tr = TRACKERS[scopeId];
        var now2 = typeof ev.ts === 'number' ? ev.ts : Date.now();
        var newLen = ev.valueLen;
        var delta = newLen - tr.last_input_length;
        if (ev.inputType === 'insertFromPaste' || delta >= PASTE_BURST_CHARS) {
          tr.paste_burst_count++;
          tr.chars_pasted += Math.max(delta, 0);
          if (delta > tr.longest_paste_chars) tr.longest_paste_chars = delta;
        } else if (delta > 0 && tr.last_input_ts !== null) {
          var dt = Math.max((now2 - tr.last_input_ts) / 1000, 0.001);
          var rate = delta / dt;
          if (delta >= 10 && rate >= PASTE_BURST_RATE) {
            tr.paste_burst_count++;
            tr.chars_pasted += delta;
            if (delta > tr.longest_paste_chars) tr.longest_paste_chars = delta;
          }
        }
        tr.last_input_ts = now2;
        tr.last_input_length = newLen;
      }
    });
  }

  // ============================================================
  // EXPORT
  // ============================================================

  var CompositionIntegrity = {
    observe: observe,
    readSnapshot: readSnapshot,
    // Test-only surface
    _resetForTests: _resetForTests,
    _getTrackerForTests: _getTrackerForTests,
    _feedEventsForTests: _feedEventsForTests,
    _analyze: _analyze,
    // Constants exposed for docs / tuning
    THRESHOLDS: {
      PASTE_BURST_CHARS: PASTE_BURST_CHARS,
      PASTE_BURST_RATE: PASTE_BURST_RATE,
      SUBHUMAN_INTERVAL_MS: SUBHUMAN_INTERVAL_MS,
      CV_HUMAN_MIN: CV_HUMAN_MIN,
      CV_HUMAN_MAX: CV_HUMAN_MAX,
      BACKSPACE_MIN_RATIO: BACKSPACE_MIN_RATIO,
      BACKSPACE_MIN_TEXT_LEN: BACKSPACE_MIN_TEXT_LEN,
      MIN_INTERVALS_FOR_CV: MIN_INTERVALS_FOR_CV,
      MIN_CHARS_FOR_VERDICT: MIN_CHARS_FOR_VERDICT
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompositionIntegrity;
  } else if (typeof root !== 'undefined') {
    root.SWSCompositionIntegrity = CompositionIntegrity;
  }

})(typeof window !== 'undefined' ? window : this);
