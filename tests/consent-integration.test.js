/**
 * SWS Attention Protocol — Consent Wiring Tests
 *
 * Verifies the consent module plugs into the receipt → VC → signed JWT
 * pipeline correctly.
 *
 * Covers:
 *   - getReceiptAttestation() returns well-formed record after setConsent()
 *   - getReceiptAttestation() returns null with no consent record
 *   - receipt.consent is covered by the integrity hash (tampering fails verify)
 *   - VC fromReceipt carries consent to credentialSubject.consentAttestation
 *   - signed JWT round-trips consent through EdDSA
 *   - Five-layer coexistence: env + behavioral + CI + consent + OTS on one receipt
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
const { loadSDK, localStorageMock } = require('./setup');

const signer = require('../src/sdk/attention-signer');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
  loadSDK('../src/sdk/privacy-compliance.js');
});

const VC = require('../src/sdk/verifiable-credentials');

beforeEach(() => {
  localStorageMock.clear();
});

function setFullConsent() {
  global.SWSPrivacy.setConsent({
    attention_tracking: true,
    behavioral_analysis: true,
    cloud_sync: true
  });
}

// ============================================================
// ATTESTATION SHAPE
// ============================================================

describe('privacy-compliance — getReceiptAttestation', () => {
  test('returns null when no consent record exists', () => {
    const att = global.SWSPrivacy.getReceiptAttestation();
    expect(att).toBeNull();
  });

  test('returns well-formed attestation after setConsent', () => {
    setFullConsent();
    const att = global.SWSPrivacy.getReceiptAttestation({
      policyUrl: 'https://example.com/privacy'
    });
    expect(att).not.toBeNull();
    expect(att.granted).toBe(true);
    expect(att.categories).toEqual(expect.arrayContaining([
      'attention_tracking', 'behavioral_analysis', 'cloud_sync'
    ]));
    expect(typeof att.timestamp).toBe('string');
    expect(att.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(att.version).toBe('1.0');
    expect(att.policy_url).toBe('https://example.com/privacy');
  });

  test('granted=false when all categories revoked', () => {
    global.SWSPrivacy.setConsent({ attention_tracking: false, behavioral_analysis: false });
    const att = global.SWSPrivacy.getReceiptAttestation();
    expect(att.granted).toBe(false);
    expect(att.categories).toEqual([]);
  });

  test('partial consent surfaces only granted categories', () => {
    global.SWSPrivacy.setConsent({
      attention_tracking: true,
      behavioral_analysis: false,
      cloud_sync: true
    });
    const att = global.SWSPrivacy.getReceiptAttestation();
    expect(att.categories).toContain('attention_tracking');
    expect(att.categories).toContain('cloud_sync');
    expect(att.categories).not.toContain('behavioral_analysis');
  });
});

// ============================================================
// RECEIPT SCHEMA + HASH COVERAGE
// ============================================================

describe('consent — receipt schema', () => {
  test('generateReceipt attaches consent block', () => {
    setFullConsent();
    const att = global.SWSPrivacy.getReceiptAttestation();
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7 },
      hashIds: ['h'], gameId: 'g',
      consent: att
    });
    expect(receipt.consent).toBeDefined();
    expect(receipt.consent.granted).toBe(true);
    expect(receipt.consent.categories.length).toBeGreaterThan(0);
  });

  test('tampering with consent breaks integrity hash', (done) => {
    setFullConsent();
    const att = global.SWSPrivacy.getReceiptAttestation();
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7 },
      hashIds: ['h'], gameId: 'g',
      consent: att
    });

    receipt.consent.granted = false;
    receipt.consent.categories = [];

    global.SWSReceipts.verifyReceipt(receipt, (result) => {
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/hash_mismatch/);
      done();
    });
  });

  test('null consent omitted from VC credentialSubject', () => {
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7 },
      hashIds: ['h'], gameId: 'g'
    });
    expect(receipt.consent).toBeNull();
    const cred = VC.fromReceipt(receipt);
    expect(cred.credentialSubject.consentAttestation).toBeUndefined();
  });
});

// ============================================================
// VC + SIGNED JWT ROUND-TRIP
// ============================================================

describe('consent — VC + signed JWT', () => {
  test('fromReceipt carries consent into credentialSubject.consentAttestation', () => {
    setFullConsent();
    const att = global.SWSPrivacy.getReceiptAttestation({
      policyUrl: 'https://sws-attention-proofs.web.app/privacy'
    });
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7 },
      hashIds: ['h'], gameId: 'g',
      consent: att
    });
    const cred = VC.fromReceipt(receipt);
    expect(cred.credentialSubject.consentAttestation).toBeDefined();
    expect(cred.credentialSubject.consentAttestation.granted).toBe(true);
    expect(cred.credentialSubject.consentAttestation.policyUrl).toBe('https://sws-attention-proofs.web.app/privacy');
    expect(typeof cred.credentialSubject.consentAttestation.note).toBe('string');
  });

  test('signed JWT round-trips consent through EdDSA', async () => {
    setFullConsent();
    const att = global.SWSPrivacy.getReceiptAttestation();
    const receipt = global.SWSReceipts.generateReceipt({
      userId: 'u', contentId: 'c', contentName: 'n',
      durationMs: 60000, focusScore: 70, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.7 },
      hashIds: ['h'], gameId: 'g',
      consent: att
    });
    const cred = VC.fromReceipt(receipt);

    const kp = await signer.generateKeypair({ kid: 'consent-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'consent-test' });
    const jwt = await VC.toSignedJwt(cred, s);
    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);

    expect(v.valid).toBe(true);
    expect(v.payload.vc.credentialSubject.consentAttestation.granted).toBe(true);
  });
});

// ============================================================
// FIVE-LAYER COEXISTENCE
// ============================================================

describe('consent — five-layer attestation stack', () => {
  test('all five layers coexist on a single receipt and survive signed JWT', async () => {
    setFullConsent();
    const consentAtt = global.SWSPrivacy.getReceiptAttestation();

    const fixture = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, 'fixtures/ots-pending.json'), 'utf8'
    ));

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
      userId: 'u', contentId: 'c', contentName: 'Five Layer Test',
      durationMs: 60000, focusScore: 80, qualityTier: 'active',
      interactionCount: 20,
      humanConfidence: { composite: 0.8 },
      hashIds: ['h1'], gameId: 'g',
      environmental: env,
      composition_integrity: ci,
      consent: consentAtt,
      ots: JSON.parse(JSON.stringify(fixture.stamped))
    });

    expect(receipt.environmental).toBeDefined();
    expect(receipt.composition_integrity).toBeDefined();
    expect(receipt.consent).toBeDefined();
    expect(receipt.ots).toBeDefined();
    expect(receipt.proof.receipt_hash).toBeTruthy();

    const cred = VC.fromReceipt(receipt);
    expect(cred.credentialSubject.environmental).toBeDefined();
    expect(cred.credentialSubject.compositionIntegrity).toBeDefined();
    expect(cred.credentialSubject.consentAttestation).toBeDefined();
    expect(cred.credentialSubject.bitcoinAnchor).toBeDefined();

    // Full pipeline: sign JWT, verify, inspect all layers inside
    const kp = await signer.generateKeypair({ kid: 'five-layer' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'five-layer' });
    const jwt = await VC.toSignedJwt(cred, s);
    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);

    expect(v.valid).toBe(true);
    const subj = v.payload.vc.credentialSubject;
    expect(subj.environmental.bot).toBe(false);
    expect(subj.compositionIntegrity.verdict).toBe('authored');
    expect(subj.consentAttestation.granted).toBe(true);
    expect(subj.bitcoinAnchor.status).toBe('pending');
  });
});
