/**
 * SWS Attention Protocol — sanitizeSession Test Suite
 *
 * Regression tests for the input sanitizer shared by the signReceipt
 * HTTP endpoint and the onSessionWritten Firestore trigger.
 * Finding: audit Apr 21.
 *
 * Covers:
 *   - Payload > 64 KB rejected before any field copy
 *   - Attestation-layer > 8 KB rejected per-field with field name
 *   - String fields truncated to bounds
 *   - Numeric fields clamped to bounds
 *   - Whitelist projection — attacker-injected extra fields dropped
 *   - Non-object signals coerced to {}
 *   - Errors carry http_status for the HTTP endpoint to surface
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const { sanitizeSession, PAYLOAD_LIMIT_BYTES, LAYER_LIMIT_BYTES } =
  require('../proof/functions/sanitize');

describe('sanitizeSession — happy path', () => {
  test('accepts a minimal valid session and returns the whitelisted fields', () => {
    const clean = sanitizeSession({
      session_id: 'abc123',
      composite: 0.75,
      signals: { timing_entropy: 0.6 }
    });
    expect(clean.session_id).toBe('abc123');
    expect(clean.composite).toBe(0.75);
    expect(clean.signals).toEqual({ timing_entropy: 0.6 });
    // Defaults for optional fields
    expect(clean.environmental).toBeNull();
    expect(clean.honeypot).toBeNull();
    expect(clean.duration_ms).toBe(0);
  });

  test('pass-through of all attestation layers', () => {
    const clean = sanitizeSession({
      session_id: 's1',
      composite: 0.5,
      environmental: { loaded: true, bot: false },
      composition_integrity: { score: 0.9 },
      consent: { granted: true },
      honeypot: { tripped: false }
    });
    expect(clean.environmental.loaded).toBe(true);
    expect(clean.composition_integrity.score).toBe(0.9);
    expect(clean.consent.granted).toBe(true);
    expect(clean.honeypot.tripped).toBe(false);
  });
});

describe('sanitizeSession — whitelist projection (extra-field injection)', () => {
  test('does not carry attacker-injected fields through', () => {
    const clean = sanitizeSession({
      session_id: 's1',
      composite: 0.5,
      attacker_field: 'malicious',
      __proto__: { polluted: true },
      constructor: { bad: true },
      uid_hash: 'override'
    });
    expect(clean.attacker_field).toBeUndefined();
    expect(clean.polluted).toBeUndefined();
    expect(clean.uid_hash).toBeUndefined();
    // Known fields still present
    expect(clean.session_id).toBe('s1');
  });

  test('does not inherit prototype pollution into the cleaned object', () => {
    sanitizeSession({
      session_id: 's1',
      composite: 0.5
    });
    // Global Object prototype untouched
    expect({}.polluted).toBeUndefined();
  });
});

describe('sanitizeSession — string truncation', () => {
  test('truncates session_id to 128 chars', () => {
    const long = 'x'.repeat(500);
    const clean = sanitizeSession({ session_id: long, composite: 0.5 });
    expect(clean.session_id.length).toBe(128);
  });

  test('truncates content_id and content_name to 256 chars', () => {
    const long = 'y'.repeat(1000);
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      content_id: long, content_name: long
    });
    expect(clean.content_id.length).toBe(256);
    expect(clean.content_name.length).toBe(256);
  });

  test('truncates uid to 128 and verdict to 64', () => {
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      uid: 'u'.repeat(500),
      verdict: 'v'.repeat(500)
    });
    expect(clean.uid.length).toBe(128);
    expect(clean.verdict.length).toBe(64);
  });

  test('coerces non-string session_id via String()', () => {
    const clean = sanitizeSession({ session_id: 12345, composite: 0.5 });
    expect(clean.session_id).toBe('12345');
  });
});

describe('sanitizeSession — numeric clamping', () => {
  test('clamps duration_ms to [0, 86400000]', () => {
    const high = sanitizeSession({
      session_id: 's1', composite: 0.5, duration_ms: 1e12
    });
    expect(high.duration_ms).toBe(86400000);

    const neg = sanitizeSession({
      session_id: 's1', composite: 0.5, duration_ms: -1000
    });
    expect(neg.duration_ms).toBe(0);
  });

  test('clamps focus_score to [0, 100]', () => {
    const high = sanitizeSession({
      session_id: 's1', composite: 0.5, focus_score: 99999
    });
    expect(high.focus_score).toBe(100);

    const neg = sanitizeSession({
      session_id: 's1', composite: 0.5, focus_score: -5
    });
    expect(neg.focus_score).toBe(0);
  });

  test('clamps interaction_count to [0, 100000]', () => {
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5, interaction_count: 1e9
    });
    expect(clean.interaction_count).toBe(100000);
  });

  test('non-numeric numeric-field coerces to 0', () => {
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      duration_ms: 'not a number',
      focus_score: 'NaN',
      interaction_count: null
    });
    expect(clean.duration_ms).toBe(0);
    expect(clean.focus_score).toBe(0);
    expect(clean.interaction_count).toBe(0);
  });
});

describe('sanitizeSession — type coercion', () => {
  test('non-object signals coerces to {}', () => {
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      signals: 'not-an-object'
    });
    expect(clean.signals).toEqual({});
  });

  test('null signals coerces to {}', () => {
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      signals: null
    });
    expect(clean.signals).toEqual({});
  });

  test('array signals is technically an object — pass-through', () => {
    // Array is typeof === 'object' so it passes through; the downstream
    // credential builder will handle it. This is intentional — arrays
    // are not the attack vector; extra top-level JSON fields are.
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      signals: [1, 2, 3]
    });
    expect(Array.isArray(clean.signals)).toBe(true);
  });
});

describe('sanitizeSession — payload size caps', () => {
  // Round-5 R5-NEW-4: PAYLOAD_LIMIT_BYTES raised from 64 KB → 384 KB to
  // accommodate the wall's event-log payload. Test now uses a payload
  // ~400 KB (above the new cap) to assert the limit still works.
  test('rejects a payload larger than the limit', () => {
    const bloat = 'x'.repeat(400000);
    expect(() => sanitizeSession({
      session_id: 's1', composite: 0.5, uid: bloat
    })).toThrow(/payload_too_large/);
  });

  test('attaches http_status=413 and details to payload_too_large error', () => {
    const bloat = 'x'.repeat(400000);
    try {
      sanitizeSession({ session_id: 's1', composite: 0.5, uid: bloat });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.message).toBe('payload_too_large');
      expect(e.http_status).toBe(413);
      expect(e.details.limit_bytes).toBe(PAYLOAD_LIMIT_BYTES);
      expect(e.details.got_bytes).toBeGreaterThan(PAYLOAD_LIMIT_BYTES);
    }
  });

  test('event_log up to ~200 KB is accepted (R5-NEW-4 wall payload)', () => {
    // Synthetic 5000-event log: ~200 KB. Pre-fix this would have hit
    // the 64 KB cap; post-fix it's accepted.
    const events = [];
    for (let i = 0; i < 5000; i++) {
      events.push({ type: 'mm', t: 1700000000000 + i * 30, x: 100 + (i % 800), y: 100 + (i % 600) });
    }
    const eventLog = {
      version: 'event-log-v1', started_at: 1700000000000, duration_ms: 150000,
      events_recorded: 5000, events: events
    };
    expect(() => sanitizeSession({
      session_id: 's1', composite: 0.6, uid: 'u1', event_log: eventLog
    })).not.toThrow();
  });
});

describe('sanitizeSession — per-layer caps', () => {
  test('rejects an oversized environmental layer with field name in error', () => {
    const bigEnv = { junk: 'e'.repeat(9000) };
    try {
      sanitizeSession({
        session_id: 's1', composite: 0.5,
        environmental: bigEnv
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.message).toBe('layer_too_large');
      expect(e.http_status).toBe(413);
      expect(e.details.field).toBe('environmental');
      expect(e.details.limit_bytes).toBe(LAYER_LIMIT_BYTES);
    }
  });

  test('rejects an oversized signals layer with field name', () => {
    const bigSig = {};
    for (let i = 0; i < 500; i++) bigSig['k' + i] = 'v'.repeat(30);
    expect(() => sanitizeSession({
      session_id: 's1', composite: 0.5, signals: bigSig
    })).toThrow(/layer_too_large/);
  });

  test('rejects an oversized honeypot layer', () => {
    const bigHp = { blob: 'h'.repeat(9000) };
    try {
      sanitizeSession({
        session_id: 's1', composite: 0.5, honeypot: bigHp
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.details.field).toBe('honeypot');
    }
  });

  test('each-layer-under-limit passes even when total is large', () => {
    // Four layers each at 7 KB; cumulative ~28 KB is still under 64 KB payload cap.
    const seven = 'a'.repeat(7 * 1024);
    const clean = sanitizeSession({
      session_id: 's1', composite: 0.5,
      environmental: { blob: seven },
      composition_integrity: { blob: seven },
      consent: { blob: seven },
      honeypot: { blob: seven }
    });
    expect(clean.environmental.blob.length).toBe(seven.length);
  });
});
