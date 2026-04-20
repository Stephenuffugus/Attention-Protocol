/**
 * SWS Attention Protocol — OpenBadges 3.0 Test Suite
 *
 * Covers:
 *   - createAchievement shape + required fields
 *   - fromReceipt produces a valid OB 3.0 + VC 2.0 credential
 *   - Privacy: subject DIDs are pseudonymous; emails redacted
 *   - Evidence array includes signed JWT + receipt hash + OTS (when present)
 *   - Identity hash pattern (OB 3.0 §8.1) works when explicitly requested
 *   - Signed-JWT round-trip via attention-signer
 *   - validate() structural checks catch common breakages
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const { loadSDK } = require('./setup');

const ob = require('../src/sdk/open-badge');
const signer = require('../src/sdk/attention-signer');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

function plausibleReceipt(overrides) {
  const r = global.SWSReceipts.generateReceipt({
    userId: 'demo_ob_user',
    contentId: 'cme_101',
    contentName: 'CME Module 101',
    durationMs: 315000,
    focusScore: 82,
    qualityTier: 'active',
    interactionCount: 55,
    humanConfidence: { composite: 0.78, timing: 0.80, fitts: 0.75 },
    hashIds: ['h1', 'h2', 'h3'],
    gameId: 'ob_test'
  });
  if (overrides) Object.assign(r, overrides);
  return r;
}

function sampleAchievement() {
  return ob.createAchievement({
    id: 'https://example.com/achievements/cme-101',
    name: 'Pharma Safety CME 101',
    description: 'Completion with verified human attention (composite >= 0.55).',
    criteriaNarrative: 'Learner completes the module and achieves composite score >= 0.55 with granted consent.',
    tag: ['cme', 'pharma', 'safety']
  });
}

// ============================================================
// createAchievement
// ============================================================

describe('open-badge — createAchievement', () => {
  test('builds a minimal valid Achievement', () => {
    const a = ob.createAchievement({ id: 'urn:ach:1', name: 'Test' });
    expect(a.id).toBe('urn:ach:1');
    expect(a.type).toContain('Achievement');
    expect(a.name).toBe('Test');
    expect(a.criteria && a.criteria.narrative).toBeTruthy();
  });

  test('rejects when id or name missing', () => {
    expect(() => ob.createAchievement({ name: 'no_id' })).toThrow(/requires_id_and_name/);
    expect(() => ob.createAchievement({ id: 'urn:x' })).toThrow(/requires_id_and_name/);
  });

  test('carries optional description, tag, image, achievementType', () => {
    const a = ob.createAchievement({
      id: 'urn:x', name: 'X',
      description: 'desc',
      tag: ['a', 'b'],
      image: 'https://example.com/badge.png',
      achievementType: 'Certification'
    });
    expect(a.description).toBe('desc');
    expect(a.tag).toEqual(['a', 'b']);
    expect(a.image.id).toBe('https://example.com/badge.png');
    expect(a.achievementType).toBe('Certification');
  });
});

// ============================================================
// fromReceipt — credential shape
// ============================================================

describe('open-badge — fromReceipt shape', () => {
  test('produces a valid OB 3.0 + VC 2.0 credential', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    expect(cred['@context']).toContain(ob.VC_CONTEXT);
    expect(cred['@context']).toContain(ob.OB3_CONTEXT);
    expect(cred.type).toContain('VerifiableCredential');
    expect(cred.type).toContain('OpenBadgeCredential');
    expect(cred.issuer.id).toBe(ob.ISSUER_DID);
    expect(cred.issuer.type).toContain('Profile');
    expect(cred.credentialSubject.type).toContain('AchievementSubject');
    expect(cred.credentialSubject.achievement.id).toBe('https://example.com/achievements/cme-101');
  });

  test('rejects missing receipt or achievement', () => {
    expect(() => ob.fromReceipt(null, sampleAchievement())).toThrow(/missing_receipt/);
    expect(() => ob.fromReceipt(plausibleReceipt(), null)).toThrow(/missing_achievement/);
  });

  test('subject DID is pseudonymous (not email)', () => {
    const receipt = plausibleReceipt({ subject_id: 'alice@example.com' });
    const cred = ob.fromReceipt(receipt, sampleAchievement());
    expect(cred.credentialSubject.id).toMatch(/^did:sws:user:/);
    expect(cred.credentialSubject.id).not.toContain('@');
  });

  test('opts.subjectDid override is respected', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement(), {
      subjectDid: 'did:ion:EiBcustom'
    });
    expect(cred.credentialSubject.id).toBe('did:ion:EiBcustom');
  });

  test('passes through existing did: prefix unchanged', () => {
    const receipt = plausibleReceipt({ subject_id: 'did:sws:user:abc' });
    const cred = ob.fromReceipt(receipt, sampleAchievement());
    expect(cred.credentialSubject.id).toBe('did:sws:user:abc');
  });
});

// ============================================================
// Results — the attention composite as OB 3.0 evidence
// ============================================================

describe('open-badge — results', () => {
  test('behavioral composite becomes a Result entry', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    expect(Array.isArray(cred.credentialSubject.result)).toBe(true);
    const scoreResult = cred.credentialSubject.result.find(r => r.value);
    expect(scoreResult).toBeDefined();
    expect(parseFloat(scoreResult.value)).toBeCloseTo(0.78, 5);
  });

  test('verdict surfaces as a second Result entry', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    const statusResult = cred.credentialSubject.result.find(r => r.status);
    expect(statusResult).toBeDefined();
    expect(statusResult.status).toMatch(/verified_human/);
  });
});

// ============================================================
// Evidence — the cryptographic proof chain
// ============================================================

describe('open-badge — evidence', () => {
  test('evidence includes the signed receipt JWT when provided', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement(), {
      signedReceiptJwt: 'eyJhbGc.payload.sig'
    });
    const jwtEvidence = cred.evidence.find(e => e.genre === 'attention_attestation');
    expect(jwtEvidence).toBeDefined();
    expect(jwtEvidence.signedReceiptJwt).toBe('eyJhbGc.payload.sig');
  });

  test('evidence includes the receipt integrity hash', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    const hashEvidence = cred.evidence.find(e => e.genre === 'integrity_hash');
    expect(hashEvidence).toBeDefined();
    expect(hashEvidence.receiptHash).toBeTruthy();
  });

  test('evidence includes OTS timestamp anchor when present', () => {
    const r = plausibleReceipt();
    r.ots = { status: 'bitcoin_confirmed', bitcoin_block_height: 918234, proof_b64: 'A...' };
    const cred = ob.fromReceipt(r, sampleAchievement());
    const otsEvidence = cred.evidence.find(e => e.genre === 'timestamp_anchor');
    expect(otsEvidence).toBeDefined();
    expect(otsEvidence.bitcoinBlockHeight).toBe(918234);
    expect(otsEvidence.narrative).toContain('918234');
  });

  test('evidence omitted when no cryptographic material is present', () => {
    // Clear the hash without nuking the whole proof object — the async
    // receipt-hash update path keeps a reference that would crash on null.
    const r = plausibleReceipt();
    r.proof.receipt_hash = '';
    const cred = ob.fromReceipt(r, sampleAchievement());
    expect(cred.evidence).toBeUndefined();
  });
});

// ============================================================
// OB 3.0 §8.1 identity-hash pattern
// ============================================================

describe('open-badge — identity hash', () => {
  test('identifier is included when recipient.identityHash provided', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement(), {
      recipient: {
        identityHash: 'sha256$abcdef123456',
        identityType: 'emailSha256',
        salt: 'some_salt'
      }
    });
    expect(Array.isArray(cred.credentialSubject.identifier)).toBe(true);
    expect(cred.credentialSubject.identifier[0].hashed).toBe(true);
    expect(cred.credentialSubject.identifier[0].identityHash).toBe('sha256$abcdef123456');
    expect(cred.credentialSubject.identifier[0].salt).toBe('some_salt');
  });

  test('identifier absent by default', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    expect(cred.credentialSubject.identifier).toBeUndefined();
  });
});

// ============================================================
// validate()
// ============================================================

describe('open-badge — validate', () => {
  test('accepts a well-formed credential', () => {
    const v = ob.validate(ob.fromReceipt(plausibleReceipt(), sampleAchievement()));
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });

  test('catches missing OB 3.0 context', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    cred['@context'] = cred['@context'].filter(c => c !== ob.OB3_CONTEXT);
    const v = ob.validate(cred);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('missing_ob3_context');
  });

  test('catches missing OpenBadgeCredential type', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    cred.type = cred.type.filter(t => t !== 'OpenBadgeCredential');
    const v = ob.validate(cred);
    expect(v.errors).toContain('missing_ob_type');
  });

  test('catches missing achievement fields', () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    delete cred.credentialSubject.achievement.criteria;
    const v = ob.validate(cred);
    expect(v.errors).toContain('missing_achievement_criteria');
  });
});

// ============================================================
// Signed JWT round-trip
// ============================================================

describe('open-badge — signed JWT', () => {
  test('toSignedJwt produces a verifiable EdDSA JWT carrying the OB credential', async () => {
    const kp = await signer.generateKeypair({ kid: 'ob-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'ob-test' });

    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement(), {
      signedReceiptJwt: 'eyJhbGc.payload.sig'
    });
    const jwt = await ob.toSignedJwt(cred, s);
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3);

    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
    expect(v.payload.vc.type).toContain('OpenBadgeCredential');
    expect(v.payload.vc.credentialSubject.achievement.name).toBe('Pharma Safety CME 101');
  });

  test('toSignedJwt rejects missing signer', async () => {
    const cred = ob.fromReceipt(plausibleReceipt(), sampleAchievement());
    await expect(ob.toSignedJwt(cred, null)).rejects.toThrow(/missing_signer/);
  });
});
