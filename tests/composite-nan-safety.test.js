/**
 * SWS Attention Protocol — Composite NaN-safety regression tests
 *
 * Catches the failure mode discovered in the 2026-05-06 corpus batch:
 * iPhone screen-sleep starves certain signals of input, one of them
 * returns NaN, NaN propagates through the weighted sum, the result is
 * serialized as undefined, and Firestore silently drops the field.
 * Outcome: 4 of 9 sessions in that batch had no composite — looked like
 * a complete write but the headline number was missing.
 *
 * The fix: in computeHumanConfidence, treat NaN/undefined/Infinity
 * exactly like the -1 "insufficient data" sentinel. composite must
 * always be a finite number in [0, 1].
 *
 * Run with: npx jest tests/composite-nan-safety.test.js
 */

'use strict';

const { loadSDK, resetState } = require('./setup');

loadSDK('../src/sdk/secure-config.js');
loadSDK('../src/sdk/attention-protocol.js');

beforeEach(() => {
  resetState();
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  SWSAttention.init({ gameId: 'nan_test', debug: false, enableBehavioralAnalysis: true });
});

describe('composite NaN-safety', () => {
  test('fresh init returns a finite, in-range composite via public API', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(typeof c.composite).toBe('number');
    expect(isFinite(c.composite)).toBe(true);
    expect(isNaN(c.composite)).toBe(false);
    expect(c.composite).toBeGreaterThanOrEqual(0);
    expect(c.composite).toBeLessThanOrEqual(1);
  });

  test('zero-event session (the screen-sleep failure mode) → composite is finite and bounded', () => {
    // Init then immediately compute. Effectively no keystrokes, mouse
    // moves, scrolls, or device-motion events have fired — most signals
    // return -1 (insufficient data). Pre-fix: at least one signal could
    // return NaN here, propagate through the weighted sum, and produce
    // composite=NaN → Firestore dropped the field. Post-fix: composite
    // is always a finite number in [0, 1], regardless of how few signals
    // had data.
    const c = SWSAttention.getHumanConfidence();
    expect(c.activeSignals).toBeLessThan(10); // few signals with data
    expect(typeof c.composite).toBe('number');
    expect(isFinite(c.composite)).toBe(true);
    expect(isNaN(c.composite)).toBe(false);
    expect(c.composite).toBeGreaterThanOrEqual(0);
    expect(c.composite).toBeLessThanOrEqual(1);
  });

  test('composite round-trips through JSON (Firestore serialization safety)', () => {
    // Firestore drops undefined and (depending on SDK options) errors on
    // NaN. Round-tripping through JSON catches both: undefined → field
    // absent, NaN → "null". After the fix, composite must survive
    // JSON.parse(JSON.stringify(...)) as the same number.
    const c = SWSAttention.getHumanConfidence();
    const round = JSON.parse(JSON.stringify({ composite: c.composite }));
    expect(round.composite).toBe(c.composite);
    expect(typeof round.composite).toBe('number');
  });
});
