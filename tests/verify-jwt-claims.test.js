/**
 * Round-3 R3-NEW-12: regression coverage for the JWT-claim enforcement
 * round-2 + T2 + round-3 added to verify.html. The browser surface uses
 * SubtleCrypto + Date.parse + window globals which are awkward to test
 * directly in Jest, so this suite exercises the equivalent Node-side
 * path (attention-signer.js#verifyJwt) with the new opts.acceptedIssuers
 * + opts.jwk parameters. The Node-side mirror was added in commit
 * e22ffdf as round-3 critical fix #3 (Node-side parity).
 *
 * Each test crafts a JWT with a specific claim shape, signs it with a
 * fresh test key, and asserts the verifier produces the right
 * claim error (or accepts a clean receipt).
 */
const signer = require('../src/sdk/attention-signer');

const ACCEPTED_ISSUERS = new Set([
  'did:web:sws-attention-proofs.web.app',
  'did:web:test'
]);

let kp;
let jwk;
let signerObj;

beforeAll(async () => {
  kp = await signer.generateKeypair({ kid: 'test-kid-2026' });
  signerObj = await signer.createSigner(kp.privateKeyHex, { kid: kp.kid });
  jwk = {
    ...kp.publicKeyJwk,
    sws_validFrom: '2026-01-01T00:00:00Z',
    sws_validUntil: '2027-01-01T00:00:00Z'
  };
});

async function sign(payload) {
  return await signer.signJwt(payload, signerObj);
}

const NOW_SEC_2026_06 = Math.floor(new Date('2026-06-15T00:00:00Z').getTime() / 1000);

describe('attention-signer.verifyJwt — R3-NEW-12 claim coverage', () => {
  test('clean payload verifies with acceptedIssuers + jwk', async () => {
    const jwt = await sign({
      iss: 'did:web:test',
      sub: 'did:test:user',
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400,
      vc: { issuer: { id: 'did:web:test' }, credentialSubject: {} }
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(true);
    expect(result.payload.iss).toBe('did:web:test');
  });

  test('expired token rejected', async () => {
    const longPast = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000);
    const jwt = await sign({
      iss: 'did:web:test',
      iat: longPast,
      exp: longPast + 60
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('token_expired');
  });

  test('not-yet-valid (nbf in future) rejected', async () => {
    const farFuture = Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000);
    const jwt = await sign({
      iss: 'did:web:test',
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400,
      nbf: farFuture
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.claimErrors).toContain('not_yet_valid');
  });

  test('unknown issuer rejected when acceptedIssuers passed', async () => {
    const jwt = await sign({
      iss: 'did:web:attacker.example',
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.claimErrors).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown_issuer/)])
    );
  });

  test('vc.issuer.id mismatch rejected', async () => {
    const jwt = await sign({
      iss: 'did:web:test',
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400,
      vc: {
        issuer: { id: 'did:web:different.example' },
        credentialSubject: {}
      }
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.claimErrors).toContain('iss_vc_issuer_mismatch');
  });

  test('iat before kid validFrom rejected (R2-NEW-5 + R3-NEW-2)', async () => {
    const beforeWindow = Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000);
    const jwt = await sign({
      iss: 'did:web:test',
      iat: beforeWindow,
      exp: NOW_SEC_2026_06 + 86400  // not expired
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk,
      ignoreExp: true  // bypass expiry check; we're testing iat window
    });
    expect(result.valid).toBe(false);
    expect(result.claimErrors).toContain('iat_before_kid_validFrom');
  });

  test('iat after kid validUntil rejected (R2-NEW-5 + R3-NEW-2)', async () => {
    const afterWindow = Math.floor(new Date('2027-06-01T00:00:00Z').getTime() / 1000);
    const jwt = await sign({
      iss: 'did:web:test',
      iat: afterWindow,
      exp: afterWindow + 86400
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.claimErrors).toContain('iat_after_kid_validUntil');
  });

  test('signature mismatch rejected', async () => {
    const otherKp = await signer.generateKeypair({ kid: 'attacker-key' });
    const jwt = await sign({
      iss: 'did:web:test',
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400
    });
    // Verify with the WRONG public key — signature math fails.
    const result = await signer.verifyJwt(jwt, otherKp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_invalid');
  });

  test('alg:none rejected (defense-in-depth against classic JWT confusion)', async () => {
    // Hand-craft an alg:none JWT — header { alg: "none" }, no signature.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'did:web:test',
      iat: NOW_SEC_2026_06
    })).toString('base64url');
    const jwt = header + '.' + payload + '.';  // empty signature
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS,
      jwk: jwk
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('alg_not_eddsa');
  });

  test('opts.ignoreClaims=true bypasses claim checks (replay/audit context)', async () => {
    // A long-expired but signature-valid receipt should verify when the
    // caller explicitly opts in to ignore claims (e.g., a forensic
    // audit of an old receipt).
    const longPast = Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000);
    const jwt = await sign({
      iss: 'did:web:attacker.example',  // would normally fail iss check
      iat: longPast,
      exp: longPast + 60
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      ignoreExp: true,
      ignoreClaims: true
    });
    expect(result.valid).toBe(true);
  });

  test('omitting opts.jwk skips validity-window check (legacy callers)', async () => {
    const jwt = await sign({
      iss: 'did:web:test',
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400
    });
    // No opts.jwk → no validity window check, but other claims still
    // enforced. Old callers that don't know about JWKS validity-windows
    // remain functional.
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      acceptedIssuers: ACCEPTED_ISSUERS
    });
    expect(result.valid).toBe(true);
  });

  test('omitting opts.acceptedIssuers skips iss check (legacy callers)', async () => {
    const jwt = await sign({
      iss: 'did:web:anyone',  // would normally fail
      iat: NOW_SEC_2026_06,
      exp: NOW_SEC_2026_06 + 86400
    });
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex, {
      jwk: jwk
    });
    expect(result.valid).toBe(true);
  });
});
