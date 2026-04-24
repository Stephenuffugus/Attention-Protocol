/**
 * SWS Attention Protocol — Humanness Credential Test Suite
 *
 * Verifies the proof-of-humanness flow:
 *   - Credentials carry validUntil (default 24h from issuance)
 *   - JWT carries standard exp claim mirroring validUntil
 *   - Expired JWTs are rejected by verifier (5-min clock skew)
 *   - createHumannessPresentation strips all non-humanness fields
 *   - No PII, no timestamps beyond expiry, no signals survive the strip
 *   - Round-trips through EdDSA signing
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const { loadSDK } = require('./setup');

const signer = require('../src/sdk/attention-signer');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

const VC = require('../src/sdk/verifiable-credentials');

function sampleReceipt(overrides) {
  const r = {
    receipt_id: 'rcpt_humanness_test',
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol',
    issuer: 'SWS Strategic Media LLC',
    generated_at: new Date().toISOString(),
    generated_timestamp: Date.now(),
    subject_id: 'demo_user',
    application_id: 'humanness_test',
    content_id: 'humanness_session',
    content_name: 'Humanness Test',
    engagement: {
      duration_ms: 240000, duration_formatted: '4 min 0 sec',
      focus_score: 72, quality_tier: 'active', interaction_count: 42
    },
    human_verification: {
      composite_score: 0.72, verdict: 'verified_human_active_engagement',
      timing_entropy: 0.81, fitts_compliance: 0.78
    },
    proof: {
      hash_count: 5, hash_ids: ['h1'], algorithm: 'SHA-256',
      receipt_hash: 'abc123'
    },
    privacy: {
      no_content_recorded: true, no_pii_collected: true,
      no_urls_tracked: true, coppa_compliant: true
    }
  };
  if (overrides) Object.assign(r, overrides);
  return r;
}

// ============================================================
// validUntil + exp claim
// ============================================================

describe('humanness — validUntil and exp', () => {
  test('fromReceipt adds default validUntil 24h from issuance', () => {
    const r = sampleReceipt({ generated_at: '2026-04-21T12:00:00.000Z' });
    const cred = VC.fromReceipt(r);
    expect(cred.validUntil).toBe('2026-04-22T12:00:00.000Z');
  });

  test('opts.validUntilMs overrides the default window', () => {
    const r = sampleReceipt({ generated_at: '2026-04-21T12:00:00.000Z' });
    const cred = VC.fromReceipt(r, { validUntilMs: 60 * 60 * 1000 }); // 1 hr
    expect(cred.validUntil).toBe('2026-04-21T13:00:00.000Z');
  });

  test('receipt.valid_until takes precedence over default', () => {
    const r = sampleReceipt({
      generated_at: '2026-04-21T12:00:00.000Z',
      valid_until: '2026-05-01T00:00:00.000Z'
    });
    const cred = VC.fromReceipt(r);
    expect(cred.validUntil).toBe('2026-05-01T00:00:00.000Z');
  });

  test('signed JWT carries exp claim mirroring validUntil', async () => {
    const kp = await signer.generateKeypair({ kid: 'exp-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'exp-test' });
    // Relative date so the JWT stays within its 24h exp window regardless of
    // when the suite runs (earlier versions hardcoded 2026-04-21 and rotted).
    const issuedAt = new Date();
    const r = sampleReceipt({ generated_at: issuedAt.toISOString() });
    const cred = VC.fromReceipt(r);
    const jwt = await VC.toSignedJwt(cred, s);
    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
    expect(typeof v.payload.exp).toBe('number');
    // exp mirrors validUntil (default 24h from issuance)
    const expected = Math.floor((issuedAt.getTime() + 24 * 60 * 60 * 1000) / 1000);
    expect(v.payload.exp).toBe(expected);
  });
});

// ============================================================
// Expired JWT rejection
// ============================================================

describe('humanness — exp enforcement', () => {
  test('verifyJwt rejects an expired token with token_expired error', async () => {
    const kp = await signer.generateKeypair({ kid: 'expired-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'expired-test' });
    // Credential that expired 2 hours ago
    const pastIssued = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const r = sampleReceipt({ generated_at: pastIssued });
    const cred = VC.fromReceipt(r);
    const jwt = await VC.toSignedJwt(cred, s);

    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(false);
    expect(v.error).toBe('token_expired');
    expect(typeof v.exp).toBe('number');
    expect(typeof v.now).toBe('number');
    expect(v.now).toBeGreaterThan(v.exp);
  });

  test('verifyJwt accepts a token within the 5-minute clock-skew window', async () => {
    const kp = await signer.generateKeypair({ kid: 'skew-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'skew-test' });
    // Credential that "expired" 2 minutes ago — within the 5-min skew
    const pastIssued = new Date(Date.now() - (24 * 60 * 60 + 2 * 60) * 1000).toISOString();
    const r = sampleReceipt({ generated_at: pastIssued });
    const cred = VC.fromReceipt(r);
    const jwt = await VC.toSignedJwt(cred, s);

    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
  });

  test('verifyJwt accepts a fresh token with 1h expiry', async () => {
    const kp = await signer.generateKeypair({ kid: 'fresh-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'fresh-test' });
    const r = sampleReceipt();
    const cred = VC.fromReceipt(r, { validUntilMs: 60 * 60 * 1000 });
    const jwt = await VC.toSignedJwt(cred, s);

    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
  });
});

// ============================================================
// createHumannessPresentation
// ============================================================

describe('humanness — createHumannessPresentation', () => {
  function makeCred() {
    return VC.fromReceipt(sampleReceipt({ generated_at: '2026-04-21T12:00:00.000Z' }));
  }

  test('produces a W3C VerifiablePresentation with HumannessPresentation type', () => {
    const p = VC.createHumannessPresentation(makeCred());
    expect(p.type).toContain('VerifiablePresentation');
    expect(p.type).toContain('HumannessPresentation');
    expect(Array.isArray(p.verifiableCredential)).toBe(true);
    expect(p.verifiableCredential[0].type).toContain('HumannessCredential');
  });

  test('reveals isHuman = true for verified_human verdict', () => {
    const p = VC.createHumannessPresentation(makeCred());
    expect(p.verifiableCredential[0].credentialSubject.isHuman).toBe(true);
  });

  test('reveals isHuman = false for non-verified_human verdicts', () => {
    const r = sampleReceipt({ generated_at: '2026-04-21T12:00:00.000Z' });
    r.human_verification.verdict = 'bot_suspected';
    const cred = VC.fromReceipt(r);
    const p = VC.createHumannessPresentation(cred);
    expect(p.verifiableCredential[0].credentialSubject.isHuman).toBe(false);
  });

  test('reveals qualityTier but NOT individual signal scores', () => {
    const p = VC.createHumannessPresentation(makeCred());
    const subj = p.verifiableCredential[0].credentialSubject;
    expect(subj.qualityTier).toBe('active');
    // None of the raw signals should leak
    expect(JSON.stringify(subj)).not.toContain('timingEntropy');
    expect(JSON.stringify(subj)).not.toContain('fittsCompliance');
    expect(JSON.stringify(subj)).not.toContain('compositeScore');
  });

  test('exposes validUntil but NOT issuanceDate', () => {
    const p = VC.createHumannessPresentation(makeCred());
    const subj = p.verifiableCredential[0].credentialSubject;
    expect(subj.validUntil).toBe('2026-04-22T12:00:00.000Z');
    // The wrapped cred still carries issuanceDate for verifiers who want
    // it, but the subject view itself doesn't.
    expect(subj.issuanceDate).toBeUndefined();
  });

  test('does not leak content id, name, duration, interaction count', () => {
    const p = VC.createHumannessPresentation(makeCred());
    const subj = p.verifiableCredential[0].credentialSubject;
    const json = JSON.stringify(subj);
    expect(json).not.toContain('humanness_session');
    expect(json).not.toContain('Humanness Test');
    expect(json).not.toContain('durationMs');
    expect(json).not.toContain('interactionCount');
    expect(json).not.toContain('focusScore');
  });

  test('preserves the cryptographic proof for re-verification', () => {
    const cred = makeCred();
    const p = VC.createHumannessPresentation(cred);
    expect(p.verifiableCredential[0].proof).toBeDefined();
    expect(p.verifiableCredential[0].proof.receiptHash).toBe(cred.proof.receiptHash);
  });

  test('throws on malformed credential', () => {
    expect(() => VC.createHumannessPresentation(null)).toThrow(/invalid_credential/);
    expect(() => VC.createHumannessPresentation({})).toThrow(/invalid_credential/);
  });
});

// ============================================================
// End-to-end: receipt → humanness JWT → verify → selective disclosure
// ============================================================

describe('humanness — end-to-end flow', () => {
  test('full flow: receipt → sign → verify → humanness presentation', async () => {
    const kp = await signer.generateKeypair({ kid: 'e2e-humanness' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'e2e-humanness' });

    const r = sampleReceipt();
    const cred = VC.fromReceipt(r);
    const jwt = await VC.toSignedJwt(cred, s);

    // Verifier: decode JWT, verify, then check humanness claim
    const v = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(v.valid).toBe(true);
    expect(v.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const presentation = VC.createHumannessPresentation(v.payload.vc);
    const subject = presentation.verifiableCredential[0].credentialSubject;
    expect(subject.isHuman).toBe(true);
    expect(subject.qualityTier).toBe('active');
    expect(subject.validUntil).toBeDefined();
  });
});
