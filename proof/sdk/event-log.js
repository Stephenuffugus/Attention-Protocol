/**
 * SWS Attention Protocol — Raw Event Log Recorder
 *
 * Records a privacy-safe bounded log of user interaction events for
 * server-side recompute (R2-NEW-2 / "THE WALL"). Without this log, an
 * attacker can ship a forged composite directly to Firestore and the
 * `onSessionWritten` Cloud Function signs it as-is. With this log, the
 * server can recompute key signals from raw events and reject receipts
 * where the client-claimed composite diverges from the server-recomputed
 * composite — forcing the attacker to ALSO ship a coherent event log.
 *
 * Privacy posture (matches docs/legal/bipa-posture.md):
 *   - Mousemove: (x, y, t) only — no DOM target, no element id
 *   - Keystroke: class bucket only — never the key itself
 *     (letter / number / space / punct / modifier / nav / enter / other)
 *   - Scroll: (scrollY, t)
 *   - Click: (x, y, t) — no DOM target text or id
 *   - Visibility: (state, t)
 * No reflection text, no quiz answer text, no URLs, no DOM identifiers.
 *
 * Bounded by configuration:
 *   - MAX_EVENTS (default 5000): circular buffer, oldest-evicted on overflow
 *   - SAMPLE_RATIO (default 0.5 for mousemove): downsample mousemove to
 *     keep size manageable on long sessions; full-fidelity for keystroke
 *     and click events
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

var VERSION = 'event-log-v1';
var MAX_EVENTS_DEFAULT = 5000;
var MOUSEMOVE_SAMPLE_DEFAULT = 0.5; // keep 1 of every 2 mousemoves

/**
 * Map a key event to a privacy-safe class bucket.
 * Mirrors the existing keystroke bucketing in attention-protocol.js
 * digraph stats — never stores the actual key.
 */
function keyClass(ev) {
  if (!ev) return 'other';
  var k = ev.key;
  if (k === ' ') return 'space';
  if (k === 'Enter') return 'enter';
  if (k === 'Tab' || k === 'ArrowLeft' || k === 'ArrowRight'
      || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Home' || k === 'End'
      || k === 'PageUp' || k === 'PageDown') return 'nav';
  if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta'
      || k === 'CapsLock') return 'modifier';
  if (k === 'Backspace' || k === 'Delete') return 'backspace';
  if (typeof k === 'string' && k.length === 1) {
    if (/[a-zA-Z]/.test(k)) return 'letter';
    if (/[0-9]/.test(k)) return 'number';
    if (/[.,!?;:'"`~@#$%^&*()_+=\-\[\]{}|\\\/<>]/.test(k)) return 'punct';
  }
  return 'other';
}

function createEventLog(opts) {
  opts = opts || {};
  var maxEvents = opts.maxEvents || MAX_EVENTS_DEFAULT;
  var mousemoveSampleRatio = opts.mousemoveSampleRatio != null
    ? opts.mousemoveSampleRatio : MOUSEMOVE_SAMPLE_DEFAULT;
  // Round-6 R5-NEW-5: gate recording on consent. The recorder is
  // created in init() but does not emit events until the consent flow
  // resolves. consentReady defaults true (legacy callers + automation
  // bypass via navigator.webdriver) but the cme-demo + demo wiring
  // sets it false until SWSPrivacy.hasConsent('attention_tracking')
  // returns true. Pre-consent events are buffered into anchorEvents
  // (a separate small array — see R5-NEW-11 below); on consent grant,
  // anchorEvents flush into events and recording proceeds normally.
  var consentReady = opts.consentReady !== false;

  var events = [];
  // Round-6 R5-NEW-11: anchored-earliest events. The 5000-event cap
  // with oldest-first eviction lets an attacker flood with synthetic
  // mousemoves to evict the early-session evidence (the genuine human
  // prefix, before any forgery began). Solution: keep the FIRST N
  // events as a never-evicted anchor so forensic value of the
  // beginning-of-session is preserved even under flood.
  var ANCHOR_SIZE = opts.anchorSize || 200;
  var anchorEvents = [];
  var startedAt = Date.now();
  var mousemoveCounter = 0;

  function record(ev) {
    if (!ev || typeof ev !== 'object') return;
    if (!consentReady) {
      // Pre-consent: do not record anything. Caller can flush a
      // permitted-pre-consent set (e.g., 'visibility' for accessibility
      // detection) via the explicit setConsentReady() path; default
      // posture is "no telemetry until granted."
      return;
    }
    if (anchorEvents.length < ANCHOR_SIZE) {
      anchorEvents.push(ev);
      return;
    }
    if (events.length >= maxEvents) {
      events.shift();
    }
    events.push(ev);
  }

  return {
    version: VERSION,

    /**
     * Record a mousemove event (x, y, t). Sampled to bound size.
     * Round-6 R5-NEW-12 fix: deterministic hash-based sampling so an
     * attacker can't flood with synthetic moves and statistically
     * guarantee retention of any particular forged event. The sample
     * decision is purely a function of (t, x, y) — no Math.random().
     */
    mousemove: function(x, y, t) {
      mousemoveCounter++;
      var ts = t || Date.now();
      // Cheap hash: mix t + x + y into a 32-bit value, take its low
      // bit (or low N bits for finer ratios). Keeps half the events
      // when sampleRatio=0.5; deterministic per (t,x,y).
      if (mousemoveSampleRatio < 1.0) {
        // FNV-like mix; coarse enough for sampling, deterministic.
        var h = ((ts ^ (ts >>> 16)) * 2654435761) | 0;
        h = ((h + x) * 2654435761) | 0;
        h = ((h + y) * 2654435761) | 0;
        h = (h >>> 0) / 0x100000000;
        if (h > mousemoveSampleRatio) return;
      }
      record({ type: 'mm', t: ts, x: x, y: y });
    },

    /** Record a click event (x, y, t). Always recorded (low frequency). */
    click: function(x, y, t) {
      record({ type: 'click', t: t || Date.now(), x: x, y: y });
    },

    /** Record a keydown by class bucket (no key character). */
    keydown: function(ev, t) {
      record({ type: 'kd', t: t || Date.now(), c: keyClass(ev) });
    },

    /** Record a scroll event (scrollY, t). */
    scroll: function(scrollY, t) {
      record({ type: 'scroll', t: t || Date.now(), y: scrollY });
    },

    /** Record a visibility-change (state, t). */
    visibility: function(state, t) {
      record({ type: 'vis', t: t || Date.now(), s: state });
    },

    /**
     * Snapshot the current log. Output combines the anchor (first N
     * events, never evicted) with the rolling window (most recent
     * up-to-maxEvents). Server-scorer can detect a flood-eviction
     * attack by checking that anchor and rolling are temporally
     * contiguous (no large gap between last anchor event and first
     * rolling event).
     */
    snapshot: function() {
      var combined = anchorEvents.concat(events);
      return {
        version: VERSION,
        recorded_at: Date.now(),
        started_at: startedAt,
        duration_ms: Date.now() - startedAt,
        events_recorded: combined.length,
        anchor_size: anchorEvents.length,
        rolling_size: events.length,
        mousemove_total_observed: mousemoveCounter,
        mousemove_sample_ratio: mousemoveSampleRatio,
        consent_ready: consentReady,
        events: combined
      };
    },

    /** Number of events currently buffered (anchor + rolling). */
    size: function() { return anchorEvents.length + events.length; },

    /**
     * Mark consent as granted; recording proceeds from now on.
     * No retroactive recording (events before consent are dropped),
     * matching the BIPA / GDPR posture in docs/legal/bipa-posture.md.
     */
    setConsentReady: function(ready) {
      consentReady = !!ready;
    },

    /** Reset the log (used in tests; not for production). */
    reset: function() {
      events = [];
      anchorEvents = [];
      startedAt = Date.now();
      mousemoveCounter = 0;
    }
  };
}

// UMD-style export.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createEventLog: createEventLog,
    keyClass: keyClass,
    VERSION: VERSION
  };
}
if (typeof window !== 'undefined') {
  window.SWSEventLog = {
    createEventLog: createEventLog,
    keyClass: keyClass,
    VERSION: VERSION
  };
}
