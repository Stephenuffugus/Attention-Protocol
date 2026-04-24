/**
 * SWS Attention Protocol — Canonical Fixture Regression Tests
 *
 * Protects the four canonical demo fixtures from drifting out of spec:
 *   1. stephen-0573-anchored.json   — legacy outer-OTS reference
 *   2. humanness-sample.json        — prove-humanness.html demo, time-sensitive
 *   3. verify-sample-6layer.json    — verify.html 6-layer demo
 *   4. verify-sample-7layer.json    — verify.html full 7-layer demo (generated 2026-04-21)
 *
 * For each: validates the signed_jwt structure, verifies the signature
 * against the attention-signer's public-key JWK derived from
 * SWS_SIGNING_KEY (when present in env), and asserts the per-fixture
 * layer-field coverage so nobody silently regenerates a 7-layer fixture
 * with only 5 layers.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
try { require('dotenv').config(); } catch (_) { /* dotenv optional; signature tests will skip */ }
const signer = require('../src/sdk/attention-signer');

const FIXTURES = {
  stephen0573: path.join(__dirname, '..', 'proof', 'results', 'stephen-0573-anchored.json'),
  humanness: path.join(__dirname, '..', 'proof', 'results', 'humanness-sample.json'),
  verify6: path.join(__dirname, '..', 'proof', 'results', 'verify-sample-6layer.json'),
  verify7: path.join(__dirname, '..', 'proof', 'results', 'verify-sample-7layer.json')
};

function loadFixture(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function decodePayload(jwt) {
  const [, p] = jwt.split('.');
  return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
}

describe('canonical fixtures — presence + structure', () => {
  test.each(Object.entries(FIXTURES))('%s exists and has signed_jwt', (name, p) => {
    expect(fs.existsSync(p)).toBe(true);
    const f = loadFixture(p);
    expect(typeof f.signed_jwt).toBe('string');
    const parts = f.signed_jwt.split('.');
    expect(parts.length).toBe(3);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  test.each(Object.entries(FIXTURES))('%s JWT decodes and carries a VC payload', (name, p) => {
    const f = loadFixture(p);
    const payload = decodePayload(f.signed_jwt);
    expect(payload.iss).toBeTruthy();
    expect(payload.vc).toBeTruthy();
    expect(payload.vc.credentialSubject).toBeTruthy();
  });
});

describe('canonical fixtures — per-fixture layer coverage expectations', () => {
  test('stephen-0573 has behavioral only in credentialSubject (no layer fields)', () => {
    const cs = decodePayload(loadFixture(FIXTURES.stephen0573).signed_jwt).vc.credentialSubject;
    expect(cs.humanVerification).toBeTruthy();
    // Stephen-0573 is the legacy outer-OTS fixture; its cs carries no layer blocks
    expect(cs.environmental).toBeFalsy();
    expect(cs.compositionIntegrity).toBeFalsy();
    expect(cs.consentAttestation).toBeFalsy();
    expect(cs.bitcoinAnchor).toBeFalsy();
  });

  test('humanness-sample has environmental + composition + consent (3 layer fields)', () => {
    const cs = decodePayload(loadFixture(FIXTURES.humanness).signed_jwt).vc.credentialSubject;
    expect(cs.environmental).toBeTruthy();
    expect(cs.compositionIntegrity).toBeTruthy();
    expect(cs.consentAttestation).toBeTruthy();
    expect(cs.bitcoinAnchor).toBeFalsy();
    expect(cs.honeypotCanary).toBeFalsy();
    expect(cs.rfc3161Timestamp).toBeFalsy();
  });

  test('verify-sample-6layer has environmental + composition + consent + bitcoin (4 layer fields)', () => {
    const cs = decodePayload(loadFixture(FIXTURES.verify6).signed_jwt).vc.credentialSubject;
    expect(cs.environmental).toBeTruthy();
    expect(cs.compositionIntegrity).toBeTruthy();
    expect(cs.consentAttestation).toBeTruthy();
    expect(cs.bitcoinAnchor).toBeTruthy();
    expect(cs.honeypotCanary).toBeFalsy();
    expect(cs.rfc3161Timestamp).toBeFalsy();
  });

  test('verify-sample-7layer has ALL 7 layer fields in credentialSubject', () => {
    const cs = decodePayload(loadFixture(FIXTURES.verify7).signed_jwt).vc.credentialSubject;
    expect(cs.environmental).toBeTruthy();
    expect(cs.humanVerification).toBeTruthy();
    expect(cs.compositionIntegrity).toBeTruthy();
    expect(cs.honeypotCanary).toBeTruthy();
    expect(cs.consentAttestation).toBeTruthy();
    expect(cs.bitcoinAnchor).toBeTruthy();
    expect(cs.rfc3161Timestamp).toBeTruthy();
  });
});

describe('canonical fixtures — gated composite presence (post-2026-04-21 fixtures)', () => {
  test('verify-sample-6layer carries compositeScoreFinal after regen', () => {
    const cs = decodePayload(loadFixture(FIXTURES.verify6).signed_jwt).vc.credentialSubject;
    expect(typeof cs.humanVerification.compositeScoreFinal).toBe('number');
    expect(typeof cs.humanVerification.qualityTierFinal).toBe('string');
    expect(Array.isArray(cs.humanVerification.gatesApplied)).toBe(true);
  });

  test('humanness-sample carries compositeScoreFinal after regen', () => {
    const cs = decodePayload(loadFixture(FIXTURES.humanness).signed_jwt).vc.credentialSubject;
    expect(typeof cs.humanVerification.compositeScoreFinal).toBe('number');
  });

  test('verify-sample-7layer clean session: final == behavioral, 0 gates', () => {
    const cs = decodePayload(loadFixture(FIXTURES.verify7).signed_jwt).vc.credentialSubject;
    expect(cs.humanVerification.compositeScoreFinal).toBeCloseTo(cs.humanVerification.compositeScore, 10);
    expect(cs.humanVerification.gatesApplied.length).toBe(0);
  });
});

describe('canonical fixtures — signature validity against env key', () => {
  const envKey = process.env.SWS_SIGNING_KEY;

  (envKey ? test : test.skip).each(Object.entries(FIXTURES))(
    '%s signature verifies with env public key',
    async (name, p) => {
      const f = loadFixture(p);
      const s = await signer.loadSignerFromEnv();
      // ignoreExp: the point of this regression test is that the fixture is
      // signed by the current key, not that it's within its humanness-freshness
      // window. Static fixtures would otherwise rot every 24h; the exp behavior
      // itself is covered by humanness.test.js's dedicated exp-enforcement block.
      const result = await signer.verifyJwt(f.signed_jwt, s.publicKeyHex, { ignoreExp: true });
      expect(result.valid).toBe(true);
      expect(result.header.kid).toBe(s.kid);
    }
  );
});
