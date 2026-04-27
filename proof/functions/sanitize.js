/**
 * SWS Attention Protocol — Session input sanitizer
 *
 * Shared by the signReceipt HTTP endpoint and the onSessionWritten
 * Firestore trigger. Whitelist-projects known fields, truncates
 * strings, clamps numerics, and caps both the whole payload and
 * each attestation layer so an attacker cannot smuggle extra JSON
 * into the signed receipt. Finding: audit Apr 21.
 *
 * Pulled out to its own module so it is testable in isolation
 * without loading firebase-functions.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const LAYER_LIMIT_BYTES = 8192;
// Round-5 R5-NEW-4: raised PAYLOAD_LIMIT_BYTES from 64KB → 384KB to
// accommodate the wall's event-log payload. A 5000-event log with
// {type:'mm',t,x,y} averages ~40 bytes/event = ~200KB — the prior 64KB
// cap rejected legitimate long sessions BEFORE the wall scorer ran
// (silent legacy escape via `event_log_absent`). 384KB gives ~3x
// headroom; the event_log itself is also bounded at 5000 events by
// the recorder + 50000 by the scorer's own validateEventLog cap.
const PAYLOAD_LIMIT_BYTES = 393216;
// The event_log layer can legitimately be ~200KB on a long active
// session — exempt it from the per-layer 8KB cap. Other layers stay
// tight (8KB caps anomaly-injection vectors).
const EVENT_LOG_LIMIT_BYTES = 524288; // 512KB

function _truncate(s, n) {
  return typeof s === 'string' ? s.slice(0, n) : s;
}

function sanitizeSession(session) {
  const bodyBytes = JSON.stringify(session).length;
  if (bodyBytes > PAYLOAD_LIMIT_BYTES) {
    const err = new Error('payload_too_large');
    err.http_status = 413;
    err.details = { limit_bytes: PAYLOAD_LIMIT_BYTES, got_bytes: bodyBytes };
    throw err;
  }
  const clean = {
    session_id:     _truncate(String(session.session_id), 128),
    composite:      session.composite,
    signals:        typeof session.signals === 'object' && session.signals !== null ? session.signals : {},
    duration_ms:    Math.max(0, Math.min(86400000, Number(session.duration_ms) || 0)),
    duration_formatted: _truncate(session.duration_formatted, 64),
    focus_score:    Math.max(0, Math.min(100, Number(session.focus_score) || 0)),
    quality_tier:   _truncate(session.quality_tier, 32),
    interaction_count: Math.max(0, Math.min(100000, Number(session.interaction_count) || 0)),
    content_id:     _truncate(session.content_id, 256),
    content_name:   _truncate(session.content_name, 256),
    uid:            _truncate(session.uid, 128),
    verdict:        _truncate(session.verdict, 64),
    environmental:         session.environmental || null,
    composition_integrity: session.composition_integrity || null,
    consent:               session.consent || null,
    honeypot:              session.honeypot || null,
    event_log:             session.event_log || null
  };
  for (const k of ['environmental','composition_integrity','consent','honeypot','signals']) {
    if (clean[k] && JSON.stringify(clean[k]).length > LAYER_LIMIT_BYTES) {
      const err = new Error('layer_too_large');
      err.http_status = 413;
      err.details = { field: k, limit_bytes: LAYER_LIMIT_BYTES };
      throw err;
    }
  }
  // event_log gets a separate, larger cap.
  if (clean.event_log && JSON.stringify(clean.event_log).length > EVENT_LOG_LIMIT_BYTES) {
    const err = new Error('event_log_too_large');
    err.http_status = 413;
    err.details = { field: 'event_log', limit_bytes: EVENT_LOG_LIMIT_BYTES };
    throw err;
  }
  return clean;
}

module.exports = {
  sanitizeSession,
  PAYLOAD_LIMIT_BYTES,
  LAYER_LIMIT_BYTES,
  EVENT_LOG_LIMIT_BYTES
};
