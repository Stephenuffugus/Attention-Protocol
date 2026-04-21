/**
 * SWS Attention Protocol — Ed25519 Signer Test Suite
 *
 * Verifies:
 *   - keypair generation produces valid Ed25519 keys + JWK
 *   - sign/verify roundtrip with hex, bytes, and JWK key formats
 *   - tamper detection (payload change → invalid)
 *   - wrong-key rejection
 *   - malformed JWT handling
 *   - JWT header contains correct alg=EdDSA and kid
 *   - base64url encoding is unpadded and uses URL-safe charset
 *   - integration with verifiable-credentials.toSignedJwt()
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

function sampleReceipt() {
  return {
    receipt_id: 'rcpt_sig_test',
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol',
    issuer: 'SWS Strategic Media LLC',
    generated_at: '2026-04-20T12:00:00.000Z',
    generated_timestamp: 1745150400000,
    subject_id: 'user_test',
    application_id: 'test_app',
    content_id: 'training_module_signed',
    content_name: 'Signed Test Module',
    engagement: {
      duration_ms: 185000,
      duration_formatted: '3 min 5 sec',
      focus_score: 72,
      quality_tier: 'active',
      interaction_count: 40
    },
    human_verification: {
      composite_score: 0.573,
      timing_entropy: 0.60,
      fitts_compliance: 0.55,
      hicks_compliance: 0.50,
      scroll_saccade: 0.58,
      micro_pause: 0.62,
      touch_variance: 0.54,
      verdict: 'verified_human_active_engagement'
    },
    proof: {
      hash_count: 5,
      hash_ids: ['h1', 'h2', 'h3', 'h4', 'h5'],
      algorithm: 'SHA-256',
      receipt_hash: '7d780c38c65d878005d35cf659136d8da6efb6033451cacd9704187a23e26e3c'
    },
    privacy: {
      no_content_recorded: true,
      no_pii_collected: true,
      no_urls_tracked: true,
      coppa_compliant: true
    }
  };
}

describe('attention-signer — keypair generation', () => {
  test('generateKeypair produces 32-byte Ed25519 keys', async () => {
    const kp = await signer.generateKeypair();
    expect(kp.privateKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.kid).toBe(signer.DEFAULT_KID);
    expect(kp.issuer).toBe('did:web:sws-attention-proofs.web.app');
  });

  test('generateKeypair accepts a custom kid', async () => {
    const kp = await signer.generateKeypair({ kid: 'test-kid-123' });
    expect(kp.kid).toBe('test-kid-123');
    expect(kp.publicKeyJwk.kid).toBe('test-kid-123');
    expect(kp.jwks.keys[0].kid).toBe('test-kid-123');
  });

  test('publicKeyJwk is a valid RFC 8037 Ed25519 JWK', async () => {
    const kp = await signer.generateKeypair();
    const jwk = kp.publicKeyJwk;
    expect(jwk.kty).toBe('OKP');
    expect(jwk.crv).toBe('Ed25519');
    expect(jwk.alg).toBe('EdDSA');
    expect(jwk.use).toBe('sig');
    // x is unpadded base64url of 32 bytes → 43 chars, no +/= chars
    expect(jwk.x).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test('jwks wraps the public JWK in a valid JWK Set', async () => {
    const kp = await signer.generateKeypair();
    expect(kp.jwks).toHaveProperty('keys');
    expect(Array.isArray(kp.jwks.keys)).toBe(true);
    expect(kp.jwks.keys).toHaveLength(1);
    expect(kp.jwks.keys[0]).toEqual(kp.publicKeyJwk);
  });
});

describe('attention-signer — base64url (RFC 4648 §5)', () => {
  test('encodes without padding and uses URL-safe charset', () => {
    const encoded = signer.base64urlEncode(new Uint8Array([251, 255, 191]));
    expect(encoded).not.toContain('=');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('decode reverses encode for random bytes', () => {
    const original = new Uint8Array([0, 1, 2, 3, 254, 253, 252, 128, 127]);
    const encoded = signer.base64urlEncode(original);
    const decoded = signer.base64urlDecode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  test('encodes UTF-8 JSON correctly', () => {
    const header = JSON.stringify({ alg: 'EdDSA', typ: 'JWT' });
    const encoded = signer.base64urlEncode(header);
    const decoded = Buffer.from(signer.base64urlDecode(encoded)).toString('utf8');
    expect(decoded).toBe(header);
  });
});

describe('attention-signer — JWT sign/verify roundtrip', () => {
  let kp;
  let s;

  beforeAll(async () => {
    kp = await signer.generateKeypair({ kid: 'roundtrip-key' });
    s = await signer.createSigner(kp.privateKeyHex, { kid: 'roundtrip-key' });
  });

  test('signJwt produces a 3-part JWT with EdDSA header', async () => {
    const jwt = await signer.signJwt({ iss: 'test', sub: 'alice', iat: 1 }, s);
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    expect(parts.every(p => p.length > 0)).toBe(true);

    const header = JSON.parse(Buffer.from(signer.base64urlDecode(parts[0])).toString('utf8'));
    expect(header.alg).toBe('EdDSA');
    expect(header.typ).toBe('JWT');
    expect(header.kid).toBe('roundtrip-key');
  });

  test('verifyJwt accepts a hex-encoded public key', async () => {
    const jwt = await signer.signJwt({ sub: 'bob' }, s);
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex);
    expect(result.valid).toBe(true);
    expect(result.payload.sub).toBe('bob');
    expect(result.header.alg).toBe('EdDSA');
  });

  test('verifyJwt accepts a JWK', async () => {
    const jwt = await signer.signJwt({ sub: 'carol' }, s);
    const result = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(result.valid).toBe(true);
    expect(result.payload.sub).toBe('carol');
  });

  test('verifyJwt accepts raw public key bytes', async () => {
    const jwt = await signer.signJwt({ sub: 'dave' }, s);
    const pubBytes = signer.hexToBytes(kp.publicKeyHex);
    const result = await signer.verifyJwt(jwt, pubBytes);
    expect(result.valid).toBe(true);
  });
});

describe('attention-signer — security properties', () => {
  let kp, s, kpOther;

  beforeAll(async () => {
    kp = await signer.generateKeypair();
    s = await signer.createSigner(kp.privateKeyHex);
    kpOther = await signer.generateKeypair();
  });

  test('tampered payload fails verification', async () => {
    const jwt = await signer.signJwt({ sub: 'alice', role: 'user' }, s);
    const parts = jwt.split('.');
    // Swap payload for a tampered one (same sig, different content)
    const tampered = parts[0] + '.' + signer.base64urlEncode(
      JSON.stringify({ sub: 'alice', role: 'admin' })
    ) + '.' + parts[2];
    const result = await signer.verifyJwt(tampered, kp.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_invalid');
  });

  test('signature from wrong key fails verification', async () => {
    const jwt = await signer.signJwt({ sub: 'mallory' }, s);
    const result = await signer.verifyJwt(jwt, kpOther.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_invalid');
  });

  test('tampered signature byte fails verification', async () => {
    const jwt = await signer.signJwt({ sub: 'eve' }, s);
    const parts = jwt.split('.');
    // Corrupt the FIRST char of the signature segment (always hits real sig bytes;
    // the last base64url char can encode only padding bits and may decode identically).
    const firstChar = parts[2][0];
    const swappedChar = firstChar === 'A' ? 'B' : 'A';
    const corrupted = parts[0] + '.' + parts[1] + '.' + swappedChar + parts[2].slice(1);
    const result = await signer.verifyJwt(corrupted, kp.publicKeyHex);
    expect(result.valid).toBe(false);
  });

  test('alg=none is rejected (no algorithm downgrade)', async () => {
    const unsignedHeader = signer.base64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = signer.base64urlEncode(JSON.stringify({ sub: 'alice' }));
    const forged = unsignedHeader + '.' + payload + '.';
    const result = await signer.verifyJwt(forged, kp.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('alg_not_eddsa');
  });

  test('malformed JWT (wrong part count) fails gracefully', async () => {
    const r1 = await signer.verifyJwt('not.a.jwt.string', kp.publicKeyHex);
    expect(r1.valid).toBe(false);
    expect(r1.error).toBe('jwt_malformed');

    const r2 = await signer.verifyJwt('onlyonepart', kp.publicKeyHex);
    expect(r2.valid).toBe(false);
    expect(r2.error).toBe('jwt_malformed');
  });

  test('non-string input fails gracefully', async () => {
    const result = await signer.verifyJwt(null, kp.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('jwt_not_string');
  });

  test('invalid private key length throws', async () => {
    await expect(signer.createSigner('deadbeef')).rejects.toThrow('invalid_private_key_length');
  });
});

describe('attention-signer — VC integration', () => {
  test('toSignedJwt produces a verifiable receipt credential', async () => {
    const kp = await signer.generateKeypair({ kid: 'vc-integration' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'vc-integration' });

    // Fixture's generated_at is a fixed historical date (golden vector).
    // Default 24h expiry becomes a time-bomb once real clock passes it.
    // Override to 10y so the signature-roundtrip assertion stays stable.
    const cred = VC.fromReceipt(sampleReceipt(), { validUntilMs: 10 * 365 * 24 * 60 * 60 * 1000 });
    const jwt = await VC.toSignedJwt(cred, s);

    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3);

    const result = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(result.valid).toBe(true);
    expect(result.header.alg).toBe('EdDSA');
    expect(result.header.kid).toBe('vc-integration');
    expect(result.payload.iss).toBe('did:web:sws-attention-proofs.web.app');
    expect(result.payload.vc).toBeDefined();
    expect(result.payload.vc.credentialSubject.engagement.qualityTier).toBe('active');
    expect(result.payload.vc.proof.receiptHash).toBe(sampleReceipt().proof.receipt_hash);
  });

  test('toSignedJwt rejects missing signer', async () => {
    const cred = VC.fromReceipt(sampleReceipt());
    await expect(VC.toSignedJwt(cred, null)).rejects.toThrow('missing_signer');
    await expect(VC.toSignedJwt(cred, {})).rejects.toThrow('missing_signer');
  });

  test('legacy toJwt still works (alg=none backwards compat)', () => {
    const cred = VC.fromReceipt(sampleReceipt());
    const jwt = VC.toJwt(cred);
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3);
    // alg=none produces empty signature segment
    expect(jwt.endsWith('.')).toBe(true);
  });
});

describe('attention-signer — loadSignerFromEnv', () => {
  const originalEnv = process.env.SWS_SIGNING_KEY;
  const originalKid = process.env.SWS_SIGNING_KID;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SWS_SIGNING_KEY;
    else process.env.SWS_SIGNING_KEY = originalEnv;
    if (originalKid === undefined) delete process.env.SWS_SIGNING_KID;
    else process.env.SWS_SIGNING_KID = originalKid;
  });

  test('returns null when SWS_SIGNING_KEY unset', async () => {
    delete process.env.SWS_SIGNING_KEY;
    const s = await signer.loadSignerFromEnv();
    expect(s).toBeNull();
  });

  test('returns working signer when SWS_SIGNING_KEY is set', async () => {
    const kp = await signer.generateKeypair({ kid: 'env-test' });
    process.env.SWS_SIGNING_KEY = kp.privateKeyHex;
    process.env.SWS_SIGNING_KID = 'env-test';

    const s = await signer.loadSignerFromEnv();
    expect(s).not.toBeNull();
    expect(s.kid).toBe('env-test');

    const jwt = await signer.signJwt({ sub: 'env-user' }, s);
    const result = await signer.verifyJwt(jwt, kp.publicKeyHex);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// SECURITY — opts.ignoreExp for legitimate replay/audit (audit Apr 21)
// ============================================================

describe('verifyJwt — opts.ignoreExp', () => {
  async function buildExpiredJwt() {
    const kp = await signer.generateKeypair({ kid: 'exp-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'exp-test' });
    // exp = 1 hour in the past (well beyond the 300s skew tolerance)
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const jwt = await signer.signJwt({ sub: 'replay-audit', exp: pastExp }, s);
    return { jwt, kp };
  }

  test('expired JWT is rejected by default', async () => {
    const { jwt, kp } = await buildExpiredJwt();
    const r = await signer.verifyJwt(jwt, kp.publicKeyJwk);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('token_expired');
  });

  test('expired JWT passes when opts.ignoreExp is true AND signature is valid', async () => {
    const { jwt, kp } = await buildExpiredJwt();
    const r = await signer.verifyJwt(jwt, kp.publicKeyJwk, { ignoreExp: true });
    expect(r.valid).toBe(true);
    expect(r.payload.sub).toBe('replay-audit');
  });

  test('opts.ignoreExp does NOT bypass signature verification', async () => {
    const { jwt } = await buildExpiredJwt();
    // Sign with one keypair, verify with a different public key — signature must still fail
    const otherKp = await signer.generateKeypair({ kid: 'other' });
    const r = await signer.verifyJwt(jwt, otherKp.publicKeyJwk, { ignoreExp: true });
    expect(r.valid).toBe(false);
    expect(r.error).toBe('signature_invalid');
  });

  test('opts.ignoreExp is a no-op for unexpired tokens', async () => {
    const kp = await signer.generateKeypair({ kid: 'fresh' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'fresh' });
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = await signer.signJwt({ sub: 'fresh', exp: futureExp }, s);
    const r = await signer.verifyJwt(jwt, kp.publicKeyJwk, { ignoreExp: true });
    expect(r.valid).toBe(true);
  });
});
