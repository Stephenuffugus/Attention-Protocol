/**
 * SWS Attention Protocol — OpenTimestamps Anchor Test Suite
 *
 * Uses a pre-generated fixture (tests/fixtures/ots-pending.json) so all
 * tests run offline. Regenerate the fixture with:
 *   node tests/fixtures/build-ots-fixture.js
 *
 * Covers:
 *   - verify(hash, proof) returns hash_mismatch_with_proof on wrong hash
 *   - verify() returns proof_not_bitcoin_anchored_yet for pending proofs
 *   - verify() rejects malformed / non-string input
 *   - stamp() returns 'failed' for invalid hash (no network dependency)
 *   - receipt schema includes `ots` block and survives hash + VC path
 *   - signed JWT round-trips OTS through EdDSA
 *
 * Networked stamp/upgrade paths are smoke-tested manually (see script
 * output at file generation time).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
const { loadSDK } = require('./setup');

const anchor = require('../src/sdk/attention-anchor');
const signer = require('../src/sdk/attention-signer');

const FIXTURE = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, 'fixtures/ots-pending.json'), 'utf8'
));

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

const VC = require('../src/sdk/verifiable-credentials');

// ============================================================
// VERIFY — pure offline tests against the fixture
// ============================================================

describe('attention-anchor — verify (offline)', () => {
  test('verify against the fixture hash returns not_bitcoin_anchored_yet (pending proof)', async () => {
    const r = await anchor.verify(FIXTURE.hash_hex, FIXTURE.stamped.proof_b64);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('proof_not_bitcoin_anchored_yet');
  });

  test('verify with wrong hash returns hash_mismatch_with_proof', async () => {
    const wrongHash = 'aa'.repeat(32); // 32 bytes of 0xaa
    const r = await anchor.verify(wrongHash, FIXTURE.stamped.proof_b64);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('hash_mismatch_with_proof');
  });

  test('verify accepts Buffer and Uint8Array hash inputs', async () => {
    const hashBuf = Buffer.from(FIXTURE.hash_hex, 'hex');
    const hashU8 = new Uint8Array(hashBuf);
    const r1 = await anchor.verify(hashBuf, FIXTURE.stamped.proof_b64);
    const r2 = await anchor.verify(hashU8, FIXTURE.stamped.proof_b64);
    expect(r1.error).toBe('proof_not_bitcoin_anchored_yet');
    expect(r2.error).toBe('proof_not_bitcoin_anchored_yet');
  });

  test('verify rejects missing proof', async () => {
    const r = await anchor.verify(FIXTURE.hash_hex, '');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('missing_proof');
  });

  test('verify rejects non-32-byte hash', async () => {
    const r = await anchor.verify('deadbeef', FIXTURE.stamped.proof_b64);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('hash_must_be_32_bytes');
  });

  test('verify rejects non-hex string hash', async () => {
    const r = await anchor.verify('this is not hex!!'.padEnd(64, 'x'), FIXTURE.stamped.proof_b64);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/non_hex|32_bytes|exception/);
  });

  test('verify rejects tampered proof (invalid base64 / structure)', async () => {
    const r = await anchor.verify(FIXTURE.hash_hex, 'not-a-real-proof');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/exception|proof_not_bitcoin|hash_mismatch/);
  });
});

// ============================================================
// STAMP — error paths only (real stamping needs network)
// ============================================================

describe('attention-anchor — stamp error paths', () => {
  test('stamp rejects non-32-byte hash', async () => {
    const r = await anchor.stamp('deadbeef');
    expect(r.status).toBe('failed');
    expect(r.error).toBe('hash_must_be_32_bytes');
  });

  test('stamp rejects invalid hex', async () => {
    const r = await anchor.stamp('not-hex-at-all');
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/invalid_hash|non_hex|odd_length/);
  });
});

// ============================================================
// RECEIPT + VC INTEGRATION
// ============================================================

describe('attention-anchor — receipt + VC integration', () => {
  function makeReceipt(ots) {
    // Clone so per-test mutations can't leak across tests via the shared FIXTURE
    const otsCopy = ots ? JSON.parse(JSON.stringify(ots)) : null;
    return global.SWSReceipts.generateReceipt({
      userId: 'u1', contentId: 'c1', contentName: 'OTS Test',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7, timing: 0.6 },
      hashIds: ['h1'], gameId: 'g',
      ots: otsCopy
    });
  }

  test('generateReceipt attaches ots block when provided', () => {
    const receipt = makeReceipt(FIXTURE.stamped);
    expect(receipt.ots).toBeDefined();
    expect(receipt.ots.status).toBe('pending');
    expect(receipt.ots.detector).toBe('opentimestamps-v1');
    expect(typeof receipt.ots.proof_b64).toBe('string');
  });

  test('receipt hash does NOT cover ots (by design — ots is self-authenticating)', (done) => {
    // Rationale: OTS proofs commit to receipt_hash. Including ots in the hash
    // would create a circular dependency. Tampering with ots still fails
    // verification because the proof's embedded digest wouldn't match the
    // receipt_hash anymore.
    const receipt = makeReceipt(FIXTURE.stamped);
    receipt.ots.proof_b64 = 'tampered';
    receipt.ots.status = 'bitcoin_confirmed';
    global.SWSReceipts.verifyReceipt(receipt, (result) => {
      // Integrity hash still valid — ots is outside the hash coverage
      expect(result.valid).toBe(true);
      done();
    });
  });

  test('VC fromReceipt carries ots into credentialSubject.bitcoinAnchor', () => {
    const receipt = makeReceipt(FIXTURE.stamped);
    const cred = VC.fromReceipt(receipt);
    expect(cred.credentialSubject.bitcoinAnchor).toBeDefined();
    expect(cred.credentialSubject.bitcoinAnchor.status).toBe('pending');
    expect(cred.credentialSubject.bitcoinAnchor.detector).toBe('opentimestamps-v1');
    expect(typeof cred.credentialSubject.bitcoinAnchor.proofB64).toBe('string');
    expect(typeof cred.credentialSubject.bitcoinAnchor.note).toBe('string');
  });

  test('VC omits bitcoinAnchor when receipt has no ots block', () => {
    const receipt = makeReceipt(null);
    const cred = VC.fromReceipt(receipt);
    expect(cred.credentialSubject.bitcoinAnchor).toBeUndefined();
  });

  test('signed JWT round-trips ots through EdDSA', async () => {
    const kp = await signer.generateKeypair({ kid: 'ots-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'ots-test' });

    const receipt = makeReceipt(FIXTURE.stamped);
    const cred = VC.fromReceipt(receipt);
    const jwt = await VC.toSignedJwt(cred, s);

    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
    const ba = v.payload.vc.credentialSubject.bitcoinAnchor;
    expect(ba.status).toBe('pending');
    expect(ba.proofB64).toBe(FIXTURE.stamped.proof_b64);
  });

  test('full four-layer attestation coexists on one receipt', () => {
    const env = { loaded: true, bot: false, bot_kind: null, detector: 'botd@v2',
                  checked_at: '2026-04-21T12:00:00Z', latency_ms: 80 };
    const ci = { detector: 'sws-composition-v1', composition_verdict: 'authored',
                 composition_integrity_score: 0.9, chars_observed: 120,
                 paste_burst_count: 0, paste_burst_detected: false,
                 backspace_ratio: 0.08, backspace_suspicious: false,
                 digraph_stats: { mean_ms: 250, std_ms: 120, cv: 0.48,
                                  subhuman_interval_count: 0, total_intervals: 100 },
                 checked_at: '2026-04-21T12:00:01Z' };
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 60000, focusScore: 75, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.75 },
      hashIds: ['h'], gameId: 'g',
      environmental: env,
      composition_integrity: ci,
      ots: FIXTURE.stamped
    });
    expect(receipt.environmental).toBeDefined();
    expect(receipt.composition_integrity).toBeDefined();
    expect(receipt.ots).toBeDefined();
    expect(receipt.proof.receipt_hash).toBeTruthy();

    const cred = VC.fromReceipt(receipt);
    expect(cred.credentialSubject.environmental).toBeDefined();
    expect(cred.credentialSubject.compositionIntegrity).toBeDefined();
    expect(cred.credentialSubject.bitcoinAnchor).toBeDefined();
  });
});
