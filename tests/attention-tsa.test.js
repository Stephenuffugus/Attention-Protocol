/**
 * SWS Attention Protocol — RFC 3161 TSA Test Suite
 *
 * Uses tests/fixtures/tsa-stamp.json so all tests run offline.
 * Regenerate via: node scripts/build-tsa-fixture.js (or inline).
 *
 * Covers:
 *   - verify() accepts the fixture and returns correct genTime + policy
 *   - verify() rejects wrong-hash / missing token / malformed input
 *   - stamp() rejects invalid hash without hitting the network
 *   - receipt schema attaches tsa block (parallel to ots)
 *   - receipt.tsa is NOT covered by integrity hash (self-authenticating)
 *   - VC fromReceipt carries tsa → credentialSubject.rfc3161Timestamp
 *   - Full six-or-seven-layer coexistence with ots, env, ci, consent
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
const { loadSDK } = require('./setup');

const tsa = require('../src/sdk/attention-tsa');
const signer = require('../src/sdk/attention-signer');

const FIXTURE = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, 'fixtures/tsa-stamp.json'), 'utf8'
));

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

const VC = require('../src/sdk/verifiable-credentials');

// ============================================================
// VERIFY — pure offline
// ============================================================

describe('attention-tsa — verify (offline)', () => {
  test('verifies the fixture against its input hash', async () => {
    const r = await tsa.verify(FIXTURE.hash_hex, FIXTURE.stamped.token_b64);
    expect(r.valid).toBe(true);
    expect(r.gen_time).toBe(FIXTURE.stamped.gen_time);
    expect(r.tsa_policy_oid).toBe(FIXTURE.stamped.tsa_policy_oid);
    expect(r.serial_hex).toBe(FIXTURE.stamped.serial_hex);
  });

  test('rejects a wrong hash', async () => {
    const wrongHash = 'aa'.repeat(32);
    const r = await tsa.verify(wrongHash, FIXTURE.stamped.token_b64);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('hash_mismatch_with_token');
  });

  test('accepts Buffer and Uint8Array hash inputs', async () => {
    const hashBuf = Buffer.from(FIXTURE.hash_hex, 'hex');
    const r1 = await tsa.verify(hashBuf, FIXTURE.stamped.token_b64);
    const r2 = await tsa.verify(new Uint8Array(hashBuf), FIXTURE.stamped.token_b64);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });

  test('rejects missing / empty token', async () => {
    const r = await tsa.verify(FIXTURE.hash_hex, '');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('missing_token');
  });

  test('rejects non-32-byte hash', async () => {
    const r = await tsa.verify('deadbeef', FIXTURE.stamped.token_b64);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('hash_must_be_32_bytes');
  });

  test('rejects malformed base64 token gracefully', async () => {
    const r = await tsa.verify(FIXTURE.hash_hex, 'not-a-valid-token!!!');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/exception|hash_mismatch|missing/);
  });
});

// ============================================================
// STAMP error paths (network-independent)
// ============================================================

describe('attention-tsa — stamp error paths', () => {
  test('stamp rejects non-32-byte hash', async () => {
    const r = await tsa.stamp('deadbeef');
    expect(r.status).toBe('failed');
    expect(r.error).toBe('hash_must_be_32_bytes');
  });

  test('stamp rejects non-hex string', async () => {
    const r = await tsa.stamp('not-hex-at-all');
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/invalid_hash|non_hex|odd_length/);
  });

  test('PUBLIC_TSAS includes the expected endpoints', () => {
    expect(tsa.PUBLIC_TSAS.freetsa).toBe('https://freetsa.org/tsr');
    expect(tsa.PUBLIC_TSAS.digicert).toMatch(/digicert/);
    expect(tsa.PUBLIC_TSAS.sectigo).toMatch(/sectigo/);
  });
});

// ============================================================
// RECEIPT + VC integration
// ============================================================

describe('attention-tsa — receipt + VC integration', () => {
  function makeReceipt(extra) {
    return global.SWSReceipts.generateReceipt(Object.assign({
      userId: 'u1', contentId: 'c1', contentName: 'TSA Test',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7 },
      hashIds: ['h1'], gameId: 'g'
    }, extra));
  }

  test('generateReceipt attaches tsa block when provided', () => {
    const r = makeReceipt({ tsa: JSON.parse(JSON.stringify(FIXTURE.stamped)) });
    expect(r.tsa).toBeDefined();
    expect(r.tsa.status).toBe('signed');
    expect(r.tsa.tsa_name).toBe('freetsa.org');
    expect(r.tsa.gen_time).toBe(FIXTURE.stamped.gen_time);
  });

  test('receipt.tsa is NOT covered by integrity hash (self-authenticating)', (done) => {
    // Design rationale: the TSA TimeStampToken is itself cryptographically
    // bound to the hash — tampering makes its own verify() fail — so we
    // don't include it in the receipt_hash payload (same reasoning as ots).
    const r = makeReceipt({ tsa: JSON.parse(JSON.stringify(FIXTURE.stamped)) });
    r.tsa.token_b64 = 'tampered!!';
    r.tsa.gen_time = '1900-01-01T00:00:00Z';
    global.SWSReceipts.verifyReceipt(r, (result) => {
      // Receipt integrity still valid — tsa is outside the hash
      expect(result.valid).toBe(true);
      done();
    });
  });

  test('VC fromReceipt carries tsa into credentialSubject.rfc3161Timestamp', () => {
    const r = makeReceipt({ tsa: JSON.parse(JSON.stringify(FIXTURE.stamped)) });
    const cred = VC.fromReceipt(r);
    expect(cred.credentialSubject.rfc3161Timestamp).toBeDefined();
    expect(cred.credentialSubject.rfc3161Timestamp.status).toBe('signed');
    expect(cred.credentialSubject.rfc3161Timestamp.tsaName).toBe('freetsa.org');
    expect(cred.credentialSubject.rfc3161Timestamp.genTime).toBe(FIXTURE.stamped.gen_time);
    expect(typeof cred.credentialSubject.rfc3161Timestamp.note).toBe('string');
  });

  test('VC omits rfc3161Timestamp when receipt has no tsa block', () => {
    const r = makeReceipt();
    const cred = VC.fromReceipt(r);
    expect(cred.credentialSubject.rfc3161Timestamp).toBeUndefined();
  });

  test('signed JWT round-trips tsa through EdDSA', async () => {
    const kp = await signer.generateKeypair({ kid: 'tsa-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'tsa-test' });
    const r = makeReceipt({ tsa: JSON.parse(JSON.stringify(FIXTURE.stamped)) });
    const cred = VC.fromReceipt(r);
    const jwt = await VC.toSignedJwt(cred, s);
    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
    expect(v.payload.vc.credentialSubject.rfc3161Timestamp.tsaName).toBe('freetsa.org');
    expect(v.payload.vc.credentialSubject.rfc3161Timestamp.serialHex).toBeTruthy();
  });

  test('TSA and OTS coexist on the same receipt without conflict', () => {
    const otsFixture = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, 'fixtures/ots-pending.json'), 'utf8'
    ));
    const r = makeReceipt({
      tsa: JSON.parse(JSON.stringify(FIXTURE.stamped)),
      ots: JSON.parse(JSON.stringify(otsFixture.stamped))
    });
    expect(r.tsa).toBeDefined();
    expect(r.ots).toBeDefined();

    const cred = VC.fromReceipt(r);
    expect(cred.credentialSubject.rfc3161Timestamp).toBeDefined();
    expect(cred.credentialSubject.bitcoinAnchor).toBeDefined();
    // Both anchors are separately disclosed
    expect(cred.credentialSubject.rfc3161Timestamp.tsaName).toBe('freetsa.org');
    expect(cred.credentialSubject.bitcoinAnchor.status).toBe('pending');
  });
});
