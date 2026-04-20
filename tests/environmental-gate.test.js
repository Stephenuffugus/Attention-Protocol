/**
 * SWS Attention Protocol — Environmental Gate Test Suite
 *
 * Covers:
 *   - _normalizeResult shape handling for all BotD return shapes
 *   - Receipt schema: environmental block round-trips through generateReceipt
 *   - Receipt hash covers environmental (tampering breaks verification)
 *   - VC fromReceipt carries environmental to credentialSubject
 *   - toSignedJwt round-trips environmental through EdDSA signing
 *   - Fail-to-unknown semantics when the gate records an error
 *
 * Note: the actual BotD detection runs only in a browser (requires
 * navigator/webdriver surface). These tests exercise the wrapper's
 * surface area with synthetic inputs.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const path = require('path');
const { loadSDK } = require('./setup');

const gate = require('../proof/sdk/environmental-gate');
const signer = require('../src/sdk/attention-signer');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

const VC = require('../src/sdk/verifiable-credentials');

// ============================================================
// _normalizeResult — pure function tests
// ============================================================

describe('environmental-gate — _normalizeResult', () => {
  test('marks bot=true with bot_kind for BotD positive detection', () => {
    const r = gate._normalizeResult({ bot: true, botKind: 'headless_chrome' }, 42);
    expect(r.loaded).toBe(true);
    expect(r.bot).toBe(true);
    expect(r.bot_kind).toBe('headless_chrome');
    expect(r.latency_ms).toBe(42);
    expect(r.detector).toBe('botd@v2');
    expect(typeof r.checked_at).toBe('string');
  });

  test('marks bot=false with null bot_kind for clean environment', () => {
    const r = gate._normalizeResult({ bot: false }, 30);
    expect(r.loaded).toBe(true);
    expect(r.bot).toBe(false);
    expect(r.bot_kind).toBeNull();
  });

  test('coerces truthy bot to boolean', () => {
    const r = gate._normalizeResult({ bot: 'yes', botKind: 'selenium' }, 10);
    expect(r.bot).toBe(true);
  });

  test('handles missing input as non-bot loaded result', () => {
    const r = gate._normalizeResult(null, 5);
    expect(r.loaded).toBe(true);
    expect(r.bot).toBe(false);
    expect(r.bot_kind).toBeNull();
  });

  test('rounds latency to integer milliseconds', () => {
    const r = gate._normalizeResult({ bot: false }, 42.7);
    expect(r.latency_ms).toBe(43);
  });
});

// ============================================================
// Caching
// ============================================================

describe('environmental-gate — caching', () => {
  afterEach(() => gate._resetForTests());

  test('getCachedResult returns null before any check', () => {
    expect(gate.getCachedResult()).toBeNull();
  });

  test('check without window environment records a loaded:false result', async () => {
    // setup.js defines global.window, but the gate looks for window inside
    // the closure. Force the fail path by pointing at a bogus URL and
    // relying on Function('import(...)') failing in Jest/CJS.
    const r = await gate.check({ botdUrl: './__this_does_not_exist__.esm.js', timeoutMs: 500 });
    expect(r.loaded).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(typeof r.checked_at).toBe('string');
    expect(gate.getCachedResult()).toBe(r);
  });

  test('subsequent check() returns cached result without re-running', async () => {
    const first = await gate.check({ botdUrl: './nope.js', timeoutMs: 500 });
    const second = await gate.check({ botdUrl: './somewhere-else.js', timeoutMs: 500 });
    expect(second).toBe(first);
  });
});

// ============================================================
// Receipt schema integration
// ============================================================

describe('environmental-gate — receipt schema', () => {
  test('generateReceipt includes environmental block when provided', () => {
    const env = gate._normalizeResult({ bot: true, botKind: 'headless_chrome' }, 25);
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'bot_naive',
      contentId: 'demo',
      contentName: 'Demo Session',
      durationMs: 100000,
      focusScore: 55,
      qualityTier: 'shallow',
      interactionCount: 20,
      humanConfidence: { composite: 0.51, timing: 0.5, fitts: 0.4 },
      hashIds: ['abc123'],
      gameId: 'harness',
      environmental: env
    });

    expect(receipt.environmental).toBeDefined();
    expect(receipt.environmental.bot).toBe(true);
    expect(receipt.environmental.bot_kind).toBe('headless_chrome');
    expect(receipt.environmental.detector).toBe('botd@v2');
  });

  test('generateReceipt omits environmental (null) when not provided', () => {
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u1', contentId: 'c', contentName: 'c',
      durationMs: 1000, focusScore: 70, qualityTier: 'active',
      interactionCount: 10,
      humanConfidence: { composite: 0.7 },
      hashIds: [], gameId: 'g'
    });
    expect(receipt.environmental).toBeNull();
  });

  test('tampering with environmental breaks hash verification', (done) => {
    const env = gate._normalizeResult({ bot: false }, 20);
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 5000, focusScore: 75, qualityTier: 'active',
      interactionCount: 15,
      humanConfidence: { composite: 0.75 },
      hashIds: ['x'], gameId: 'g',
      environmental: env
    });

    // Flip the bot flag — integrity check should fail
    receipt.environmental.bot = true;
    receipt.environmental.bot_kind = 'malicious';

    global.SWSReceipts.verifyReceipt(receipt, (result) => {
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/hash_mismatch/);
      done();
    });
  });
});

// ============================================================
// VC + signed JWT integration
// ============================================================

describe('environmental-gate — verifiable credential integration', () => {
  function makeReceipt(env) {
    return {
      receipt_id: 'rcpt_env_test',
      receipt_version: '1.0',
      protocol: 'SWS Proof of Attention Protocol',
      issuer: 'SWS Strategic Media LLC',
      generated_at: '2026-04-21T12:00:00.000Z',
      generated_timestamp: 1745236800000,
      subject_id: 'test_subject',
      application_id: 'env_test',
      content_id: 'c1',
      content_name: 'Env Test',
      engagement: { duration_ms: 60000, duration_formatted: '1m', focus_score: 60, quality_tier: 'active', interaction_count: 10 },
      human_verification: { composite_score: 0.60, verdict: 'verified_human_active_engagement' },
      environmental: env,
      proof: { hash_count: 1, hash_ids: ['h'], algorithm: 'SHA-256', receipt_hash: 'abc' },
      privacy: { no_content_recorded: true, no_pii_collected: true, no_urls_tracked: true, coppa_compliant: true }
    };
  }

  test('fromReceipt carries environmental into credentialSubject', () => {
    const env = gate._normalizeResult({ bot: true, botKind: 'puppeteer' }, 35);
    const cred = VC.fromReceipt(makeReceipt(env));
    expect(cred.credentialSubject.environmental).toBeDefined();
    expect(cred.credentialSubject.environmental.loaded).toBe(true);
    expect(cred.credentialSubject.environmental.bot).toBe(true);
    expect(cred.credentialSubject.environmental.botKind).toBe('puppeteer');
    expect(cred.credentialSubject.environmental.detector).toBe('botd@v2');
    expect(typeof cred.credentialSubject.environmental.note).toBe('string');
  });

  test('fromReceipt encodes fail-to-unknown as loaded=false, bot=null', () => {
    const env = { loaded: false, error: 'botd_timeout_4000ms', checked_at: '2026-04-21T12:00:00.000Z' };
    const cred = VC.fromReceipt(makeReceipt(env));
    expect(cred.credentialSubject.environmental.loaded).toBe(false);
    expect(cred.credentialSubject.environmental.bot).toBeNull();
    expect(cred.credentialSubject.environmental.error).toBe('botd_timeout_4000ms');
  });

  test('fromReceipt omits environmental when receipt lacks one', () => {
    const cred = VC.fromReceipt(makeReceipt(null));
    expect(cred.credentialSubject.environmental).toBeUndefined();
  });

  test('signed JWT round-trips environmental through EdDSA', async () => {
    const kp = await signer.generateKeypair({ kid: 'env-vc-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'env-vc-test' });

    const env = gate._normalizeResult({ bot: true, botKind: 'headless_chrome' }, 50);
    const cred = VC.fromReceipt(makeReceipt(env));
    const jwt = await VC.toSignedJwt(cred, s);

    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
    expect(v.payload.vc.credentialSubject.environmental.bot).toBe(true);
    expect(v.payload.vc.credentialSubject.environmental.botKind).toBe('headless_chrome');
  });
});
