/**
 * SWS Attention Protocol — Composition Integrity (Signal 21) Tests
 *
 * Synthetic keystroke streams cover four canonical scenarios:
 *   1. Authored — real-ish human typing: natural jitter, backspaces.
 *   2. Pasted   — single large input event (ChatGPT copy-paste).
 *   3. Mechanical — perfectly uniform intervals, no backspaces.
 *   4. Mixed   — human typing then pastes a correction.
 *
 * Also covers:
 *   - short-text unknown verdict
 *   - receipt schema integration (environmental + composition_integrity
 *     co-exist and survive hash coverage)
 *   - VC fromReceipt carries composition_integrity through signed JWTs
 *
 * Research basis: arxiv 2511.12468 (2025).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const { loadSDK } = require('./setup');

const CI = require('../proof/sdk/composition-integrity');
const signer = require('../src/sdk/attention-signer');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

const VC = require('../src/sdk/verifiable-credentials');

// ============================================================
// HELPERS
// ============================================================

function randBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// Generate a plausible human typing stream.
// Returns an array of synthetic events.
function humanStream(charCount, opts) {
  opts = opts || {};
  const backspaceRate = opts.backspaceRate != null ? opts.backspaceRate : 0.08;
  const events = [];
  let ts = 1000;
  let valueLen = 0;

  for (let i = 0; i < charCount; i++) {
    // Human inter-key interval — roughly lognormal ~120–400ms, some outliers
    ts += Math.round(randBetween(90, 380));
    if (Math.random() < backspaceRate && valueLen > 0) {
      events.push({ type: 'keydown', key: 'Backspace', ts: ts });
      valueLen -= 1;
      ts += 20;
      events.push({ type: 'input', valueLen: valueLen, ts: ts });
    } else {
      events.push({ type: 'keydown', key: 'a', ts: ts });
      valueLen += 1;
      ts += 5;
      events.push({ type: 'input', valueLen: valueLen, ts: ts });
    }
  }
  return events;
}

// Generate a single giant paste event (ChatGPT copy-paste).
function pasteStream(charCount) {
  return [
    { type: 'input', inputType: 'insertFromPaste', valueLen: charCount, ts: 1000 }
  ];
}

// Generate a mechanically uniform keystroke stream (no backspaces, CV near 0).
function mechanicalStream(charCount, intervalMs) {
  intervalMs = intervalMs || 80;
  const events = [];
  let ts = 1000;
  let valueLen = 0;
  for (let i = 0; i < charCount; i++) {
    ts += intervalMs;
    events.push({ type: 'keydown', key: 'a', ts: ts });
    valueLen += 1;
    ts += 5;
    events.push({ type: 'input', valueLen: valueLen, ts: ts });
  }
  return events;
}

// ============================================================
// AUTHORED (human typing) — should score high
// ============================================================

describe('composition-integrity — authored stream', () => {
  beforeEach(() => CI._resetForTests());

  test('sustained human-like typing scores >= 0.75', () => {
    CI._feedEventsForTests('default', humanStream(150, { backspaceRate: 0.10 }));
    const snap = CI.readSnapshot();
    expect(snap.chars_observed).toBeGreaterThan(100);
    expect(snap.paste_burst_detected).toBe(false);
    expect(snap.backspace_suspicious).toBe(false);
    expect(snap.digraph_stats.cv).toBeGreaterThan(0.1);
    expect(snap.composition_integrity_score).toBeGreaterThanOrEqual(0.75);
    expect(snap.composition_verdict).toBe('authored');
  });

  test('human backspace ratio lands in expected band', () => {
    CI._feedEventsForTests('default', humanStream(200, { backspaceRate: 0.10 }));
    const snap = CI.readSnapshot();
    expect(snap.backspace_ratio).toBeGreaterThan(0.03);
    expect(snap.backspace_ratio).toBeLessThan(0.25);
  });
});

// ============================================================
// PASTED (ChatGPT / copy-paste) — should score low, verdict 'pasted'
// ============================================================

describe('composition-integrity — paste burst', () => {
  beforeEach(() => CI._resetForTests());

  test('single 200-char paste event flags paste_burst_detected', () => {
    CI._feedEventsForTests('default', pasteStream(200));
    const snap = CI.readSnapshot();
    expect(snap.paste_burst_detected).toBe(true);
    expect(snap.paste_burst_count).toBe(1);
    expect(snap.longest_paste_chars).toBe(200);
  });

  test('paste followed by no edits scores low and verdicts pasted', () => {
    // Paste + a handful of post-paste keystrokes (as if reviewing/confirming)
    const events = pasteStream(250).concat(humanStream(5));
    CI._feedEventsForTests('default', events);
    const snap = CI.readSnapshot();
    expect(snap.composition_verdict).toBe('pasted');
    expect(snap.composition_integrity_score).toBeLessThan(0.5);
  });

  test('two 80-char pastes count as 2 bursts', () => {
    const events = [
      { type: 'input', inputType: 'insertFromPaste', valueLen: 80, ts: 1000 },
      { type: 'input', inputType: 'insertFromPaste', valueLen: 160, ts: 5000 }
    ];
    CI._feedEventsForTests('default', events);
    const snap = CI.readSnapshot();
    expect(snap.paste_burst_count).toBe(2);
  });

  test('rate-based paste detection — 40 chars in 100ms', () => {
    // Slow start then a big fast delta without explicit insertFromPaste
    const events = [
      { type: 'input', valueLen: 5, ts: 1000 },
      { type: 'input', valueLen: 45, ts: 1100 }   // 40 chars in 0.1s = 400 char/s
    ];
    CI._feedEventsForTests('default', events);
    const snap = CI.readSnapshot();
    expect(snap.paste_burst_detected).toBe(true);
  });

  test('mobile autocomplete (~10 chars at ~200/s) does NOT trigger paste', () => {
    // iOS/Android predictive keyboards insert whole words (~6-15 chars)
    // in one input event. This must not be flagged as a paste.
    const events = [
      { type: 'input', valueLen: 5,  ts: 1000 },
      { type: 'input', valueLen: 15, ts: 1050 },  // 10 chars in 50ms = 200 c/s
      { type: 'input', valueLen: 20, ts: 1200 },  // 5 chars typed
      { type: 'input', valueLen: 31, ts: 1250 },  // 11 chars autocomplete
    ];
    CI._feedEventsForTests('default', events);
    const snap = CI.readSnapshot();
    expect(snap.paste_burst_detected).toBe(false);
    expect(snap.paste_burst_count).toBe(0);
  });
});

// ============================================================
// MECHANICAL (uniform interval bot typing) — CV near 0
// ============================================================

describe('composition-integrity — mechanical stream', () => {
  beforeEach(() => CI._resetForTests());

  test('uniform 80ms intervals have CV near 0 and verdict mechanical', () => {
    CI._feedEventsForTests('default', mechanicalStream(100, 80));
    const snap = CI.readSnapshot();
    expect(snap.digraph_stats.cv).toBeLessThan(0.05);
    expect(snap.composition_verdict).toBe('mechanical');
    expect(snap.composition_integrity_score).toBeLessThan(0.7);
  });

  test('sub-60ms interval stream flags subhuman_interval_count', () => {
    CI._feedEventsForTests('default', mechanicalStream(50, 40));
    const snap = CI.readSnapshot();
    expect(snap.digraph_stats.subhuman_interval_count).toBeGreaterThan(0);
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('composition-integrity — edge cases', () => {
  beforeEach(() => CI._resetForTests());

  test('empty tracker returns unknown verdict', () => {
    const snap = CI.readSnapshot();
    expect(snap.composition_verdict).toBe('unknown');
    expect(snap.composition_integrity_score).toBeNull();
  });

  test('short text (< MIN_CHARS_FOR_VERDICT) returns unknown', () => {
    CI._feedEventsForTests('default', humanStream(10));
    const snap = CI.readSnapshot();
    expect(snap.composition_verdict).toBe('unknown');
    expect(snap.composition_integrity_score).toBeNull();
  });

  test('THRESHOLDS are exposed for docs/tuning', () => {
    expect(CI.THRESHOLDS.PASTE_BURST_CHARS).toBe(50);
    expect(CI.THRESHOLDS.SUBHUMAN_INTERVAL_MS).toBe(60);
  });
});

// ============================================================
// RECEIPT + VC INTEGRATION
// ============================================================

describe('composition-integrity — receipt + VC integration', () => {
  beforeEach(() => CI._resetForTests());

  function buildReceipt(ci, env) {
    const params = {
      userId: 'u1', contentId: 'c1', contentName: 'Signal 21 Test',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7, timing: 0.6, fitts: 0.5, hicks: 0.5, scroll: 0.6, microPause: 0.5, touch: 0.6 },
      hashIds: ['h1', 'h2'], gameId: 'g',
      environmental: env || null,
      composition_integrity: ci || null
    };
    return global.SWSReceipts.generateReceipt(params);
  }

  test('generateReceipt includes composition_integrity when provided', () => {
    CI._feedEventsForTests('default', humanStream(150, { backspaceRate: 0.08 }));
    const ci = CI.readSnapshot();
    const receipt = buildReceipt(ci);
    expect(receipt.composition_integrity).toBeDefined();
    expect(receipt.composition_integrity.composition_verdict).toBe('authored');
    expect(receipt.composition_integrity.detector).toBe('sws-composition-v1');
  });

  test('tampering with composition_integrity breaks receipt hash', (done) => {
    CI._feedEventsForTests('default', humanStream(120));
    const ci = CI.readSnapshot();
    const receipt = buildReceipt(ci);

    receipt.composition_integrity.composition_verdict = 'authored_fake';
    receipt.composition_integrity.composition_integrity_score = 1.0;

    global.SWSReceipts.verifyReceipt(receipt, (result) => {
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/hash_mismatch/);
      done();
    });
  });

  test('signed JWT round-trips composition_integrity through EdDSA', async () => {
    CI._feedEventsForTests('default', pasteStream(300));
    const ci = CI.readSnapshot();
    const receipt = buildReceipt(ci);
    const cred = VC.fromReceipt(receipt);

    expect(cred.credentialSubject.compositionIntegrity).toBeDefined();
    expect(cred.credentialSubject.compositionIntegrity.verdict).toBe('pasted');
    expect(cred.credentialSubject.compositionIntegrity.pasteBurstDetected).toBe(true);

    const kp = await signer.generateKeypair({ kid: 'ci-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'ci-test' });
    const jwt = await VC.toSignedJwt(cred, s);
    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);

    expect(v.valid).toBe(true);
    expect(v.payload.vc.credentialSubject.compositionIntegrity.verdict).toBe('pasted');
  });

  test('environmental and composition_integrity coexist on receipt', () => {
    CI._feedEventsForTests('default', humanStream(120));
    const ci = CI.readSnapshot();
    const env = { loaded: true, bot: false, bot_kind: null,
                  detector: 'botd@v2', checked_at: '2026-04-21T12:00:00Z', latency_ms: 80 };
    const receipt = buildReceipt(ci, env);
    expect(receipt.composition_integrity).toBeDefined();
    expect(receipt.environmental).toBeDefined();
    expect(receipt.environmental.bot).toBe(false);
  });
});
