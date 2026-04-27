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

  var events = [];
  var startedAt = Date.now();
  var mousemoveCounter = 0;

  function record(ev) {
    if (!ev || typeof ev !== 'object') return;
    if (events.length >= maxEvents) {
      // Circular buffer: drop the oldest event. Reservoir sampling would
      // be more rigorous but adds complexity; for a 5000-event budget on
      // a typical 4-min CME session (~10k events untrimmed), oldest-first
      // eviction loses the early-session reading-phase events but keeps
      // the active-engagement + submit phase. Document and move on.
      events.shift();
    }
    events.push(ev);
  }

  return {
    version: VERSION,

    /** Record a mousemove event (x, y, t). Sampled to bound size. */
    mousemove: function(x, y, t) {
      mousemoveCounter++;
      if (Math.random() > mousemoveSampleRatio) return;
      record({ type: 'mm', t: t || Date.now(), x: x, y: y });
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
     * Snapshot the current log as a plain JSON-safe object. Includes
     * metadata so the server-side scorer can validate plausibility.
     */
    snapshot: function() {
      return {
        version: VERSION,
        recorded_at: Date.now(),
        started_at: startedAt,
        duration_ms: Date.now() - startedAt,
        events_recorded: events.length,
        mousemove_total_observed: mousemoveCounter,
        mousemove_sample_ratio: mousemoveSampleRatio,
        events: events.slice() // shallow copy
      };
    },

    /** Number of events currently buffered. */
    size: function() { return events.length; },

    /** Reset the log (used in tests; not for production). */
    reset: function() {
      events = [];
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
