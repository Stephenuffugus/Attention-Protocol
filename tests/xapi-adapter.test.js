/**
 * SWS Attention Protocol — xAPI Adapter Test Suite
 *
 * Verifies the adapter emits xAPI 1.0.3 Statements that any Learning
 * Record Store (LRS) can ingest: required fields present, IRIs well-
 * formed, score range valid, extensions namespaced, no PII leakage.
 *
 * Also covers the round-trip: receipt → signed JWT → xAPI statement
 * via fromSignedJwt(), the path an LMS integration will actually use.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
const { loadSDK, localStorageMock } = require('./setup');

const xapi = require('../src/sdk/xapi-adapter');
const signer = require('../src/sdk/attention-signer');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
  loadSDK('../src/sdk/privacy-compliance.js');
});

const VC = require('../src/sdk/verifiable-credentials');

beforeEach(() => { localStorageMock.clear(); });

function plausibleReceipt(overrides) {
  const base = global.SWSReceipts.generateReceipt({
    userId: 'demo_user_xapi',
    contentId: 'safety_training_101',
    contentName: 'Safety Training Module 101',
    durationMs: 305000,
    focusScore: 78,
    qualityTier: 'active',
    interactionCount: 42,
    humanConfidence: { composite: 0.82, timing: 0.75, fitts: 0.88, hicks: 0.91, scroll: 0.70, microPause: 0.65, touch: 0.80 },
    hashIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
    gameId: 'xapi_test',
    environmental: { loaded: true, bot: false, bot_kind: null, detector: 'botd@v2', checked_at: '2026-04-21T12:00:00Z', latency_ms: 80 },
    composition_integrity: { detector: 'sws-composition-v1', composition_verdict: 'authored', composition_integrity_score: 0.9, chars_observed: 120, paste_burst_count: 0, paste_burst_detected: false, backspace_ratio: 0.08, backspace_suspicious: false, digraph_stats: { mean_ms: 250, std_ms: 120, cv: 0.48, subhuman_interval_count: 0, total_intervals: 100 }, checked_at: '2026-04-21T12:00:01Z' },
    consent: { granted: true, categories: ['attention_tracking', 'behavioral_analysis'], timestamp: '2026-04-21T11:59:00Z', version: '1.0', policy_url: 'https://example.com/privacy' }
  });
  if (overrides) {
    for (const k in overrides) base[k] = overrides[k];
  }
  return base;
}

// ============================================================
// CORE SHAPE
// ============================================================

describe('xapi-adapter — core statement shape', () => {
  test('fromReceipt returns an xAPI 1.0.3 statement with required top-level fields', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(stmt.actor).toBeDefined();
    expect(stmt.verb).toBeDefined();
    expect(stmt.object).toBeDefined();
    expect(stmt.result).toBeDefined();
    expect(stmt.authority).toBeDefined();
    expect(stmt.timestamp).toBeDefined();
    expect(stmt.version).toBe('1.0.3');
  });

  test('actor uses a pseudonymous SWS DID, never an email', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt({ subject_id: 'demo_user_xapi' }));
    expect(stmt.actor.objectType).toBe('Agent');
    expect(stmt.actor.account.homePage).toBe('https://sws-attention-proofs.web.app');
    expect(stmt.actor.account.name).toMatch(/^did:sws:user:/);
    expect(JSON.stringify(stmt.actor)).not.toContain('@');
  });

  test('actor short-circuits if subject_id already a DID', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt({ subject_id: 'did:sws:user:abc123' }));
    expect(stmt.actor.account.name).toBe('did:sws:user:abc123');
  });

  test('actor redacts accidental email in subject_id', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt({ subject_id: 'alice@example.com' }));
    expect(stmt.actor.account.name).not.toContain('@');
    expect(stmt.actor.account.name).toMatch(/^did:sws:user:/);
  });
});

// ============================================================
// VERBS + ACTIVITIES
// ============================================================

describe('xapi-adapter — verbs and activities', () => {
  test('inferred verb is attended for verified_human verdict', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(stmt.verb.id).toBe('http://adlnet.gov/expapi/verbs/attended');
  });

  test('inferred verb is completed when completion.met_minimum', () => {
    const r = plausibleReceipt();
    r.completion = { met_minimum: true, engagement_sufficient: true };
    const stmt = xapi.fromReceipt(r);
    expect(stmt.verb.id).toBe('http://adlnet.gov/expapi/verbs/completed');
  });

  test('object.id is a derived IRI under the issuer homepage', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(stmt.object.id).toBe('https://sws-attention-proofs.web.app/xapi/activities/safety_training_101');
  });

  test('activityIri opt overrides the default', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt(), { activityIri: 'urn:pharma:cme:course-99' });
    expect(stmt.object.id).toBe('urn:pharma:cme:course-99');
  });

  test('object.definition.name carries the human-readable content name', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(stmt.object.definition.name['en-US']).toBe('Safety Training Module 101');
  });
});

// ============================================================
// RESULT FIELD
// ============================================================

describe('xapi-adapter — result', () => {
  test('score.scaled is the behavioral composite and is in [0,1]', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(typeof stmt.result.score.scaled).toBe('number');
    expect(stmt.result.score.scaled).toBeGreaterThanOrEqual(0);
    expect(stmt.result.score.scaled).toBeLessThanOrEqual(1);
    expect(stmt.result.score.scaled).toBeCloseTo(0.82, 5);
  });

  test('result.duration is an ISO 8601 duration', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    // 305000 ms = 5min 5sec → PT5M5S
    expect(stmt.result.duration).toMatch(/^PT.*S$/);
    expect(stmt.result.duration).toContain('5M');
  });

  test('completion + success follow from receipt.completion when present', () => {
    const r = plausibleReceipt();
    r.completion = { met_minimum: true, engagement_sufficient: false };
    const stmt = xapi.fromReceipt(r);
    expect(stmt.result.completion).toBe(true);
    expect(stmt.result.success).toBe(false);
  });
});

// ============================================================
// EXTENSIONS (the SWS-specific payload the LRS carries forward)
// ============================================================

describe('xapi-adapter — extensions', () => {
  test('attestation-layers extension includes all 5 non-crypto layers', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    const layers = stmt.result.extensions[xapi.EXT_ATTESTATION];
    expect(layers).toBeDefined();
    expect(layers.environmental).toBeDefined();
    expect(layers.composition_integrity).toBeDefined();
    expect(layers.consent).toBeDefined();
    expect(layers.behavioral).toBeDefined();
  });

  test('signedJwt opt embeds the JWT under the stable extension IRI', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt(), { signedJwt: 'eyJhbGc.payload.sig' });
    expect(stmt.result.extensions[xapi.EXT_SIGNED_JWT]).toBe('eyJhbGc.payload.sig');
  });

  test('public-key-url extension always points at the live JWKS', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(stmt.result.extensions[xapi.EXT_PUBLIC_KEY_URL])
      .toBe('https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json');
  });

  test('receipt-hash extension is included when present', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    expect(stmt.result.extensions[xapi.EXT_RECEIPT_HASH]).toBeTruthy();
  });
});

// ============================================================
// SIGNED JWT ROUND-TRIP (the LMS integration path)
// ============================================================

describe('xapi-adapter — fromSignedJwt', () => {
  test('decodes a signed JWT into a valid xAPI statement', async () => {
    const receipt = plausibleReceipt();
    const cred = VC.fromReceipt(receipt);
    const kp = await signer.generateKeypair({ kid: 'xapi-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'xapi-test' });
    const jwt = await VC.toSignedJwt(cred, s);

    const stmt = xapi.fromSignedJwt(jwt);
    const v = xapi.validate(stmt);
    expect(v.valid).toBe(true);
    expect(stmt.result.extensions[xapi.EXT_SIGNED_JWT]).toBe(jwt);
    expect(stmt.result.extensions[xapi.EXT_ATTESTATION].behavioral).toBeDefined();
  });

  test('throws clear error on non-JWT input', () => {
    expect(() => xapi.fromSignedJwt('not a jwt')).toThrow(/xapi_adapter_invalid_jwt/);
    expect(() => xapi.fromSignedJwt(null)).toThrow(/xapi_adapter_invalid_jwt/);
  });

  test('throws when JWT payload lacks vc claim', () => {
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const fakePayload = Buffer.from(JSON.stringify({ sub: 'nobody' })).toString('base64url');
    const fake = fakeHeader + '.' + fakePayload + '.sig';
    expect(() => xapi.fromSignedJwt(fake)).toThrow(/missing_vc_claim/);
  });
});

// ============================================================
// VERIFIED JWT (Class 14 fix — 2026-05-27 hostile crypto audit)
// ============================================================
// fromSignedJwt does NOT verify the signature; an attacker hand-crafting
// a JWT with alg:none or an arbitrary signature can produce a syntactically
// valid Statement. fromVerifiedJwt closes the gap by requiring a JWKS and
// verifying first.

describe('xapi-adapter — fromVerifiedJwt (Class 14 fix)', () => {
  test('accepts a properly signed JWT against the matching JWKS', async () => {
    const receipt = plausibleReceipt();
    const cred = VC.fromReceipt(receipt);
    const kp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'xapi-verify-test' });
    const jwt = await VC.toSignedJwt(cred, s);

    const jwks = { keys: [kp.publicKeyJwk] };
    const stmt = await xapi.fromVerifiedJwt(jwt, jwks);

    const v = xapi.validate(stmt);
    expect(v.valid).toBe(true);
    expect(stmt.result.extensions[xapi.EXT_SIGNED_JWT]).toBe(jwt);
  });

  test('accepts a single JWK (not an array)', async () => {
    const receipt = plausibleReceipt();
    const cred = VC.fromReceipt(receipt);
    const kp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'xapi-verify-test' });
    const jwt = await VC.toSignedJwt(cred, s);

    const stmt = await xapi.fromVerifiedJwt(jwt, kp.publicKeyJwk);
    expect(xapi.validate(stmt).valid).toBe(true);
  });

  test('accepts a bare array of JWKs', async () => {
    const receipt = plausibleReceipt();
    const cred = VC.fromReceipt(receipt);
    const kp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'xapi-verify-test' });
    const jwt = await VC.toSignedJwt(cred, s);

    const stmt = await xapi.fromVerifiedJwt(jwt, [kp.publicKeyJwk]);
    expect(xapi.validate(stmt).valid).toBe(true);
  });

  test('rejects an unsigned JWT (alg:none attack)', async () => {
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'xapi-verify-test' })).toString('base64url');
    const fakePayload = Buffer.from(JSON.stringify({ vc: { credentialSubject: { id: 'mallory' } } })).toString('base64url');
    const fake = fakeHeader + '.' + fakePayload + '.';

    const kp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    const jwks = { keys: [kp.publicKeyJwk] };
    await expect(xapi.fromVerifiedJwt(fake, jwks)).rejects.toThrow(/jwt_invalid/);
  });

  test('rejects a JWT signed with a key not in the JWKS', async () => {
    const receipt = plausibleReceipt();
    const cred = VC.fromReceipt(receipt);
    const attackerKp = await signer.generateKeypair({ kid: 'attacker-key' });
    const attackerSigner = await signer.createSigner(attackerKp.privateKeyHex, { kid: 'attacker-key' });
    const jwt = await VC.toSignedJwt(cred, attackerSigner);

    // Legitimate JWKS does NOT contain the attacker's key
    const legitKp = await signer.generateKeypair({ kid: 'legit-key' });
    const jwks = { keys: [legitKp.publicKeyJwk] };

    await expect(xapi.fromVerifiedJwt(jwt, jwks)).rejects.toThrow(/kid_not_in_jwks/);
  });

  test('rejects when JWKS is missing', async () => {
    const receipt = plausibleReceipt();
    const cred = VC.fromReceipt(receipt);
    const kp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    const s = await signer.createSigner(kp.privateKeyHex, { kid: 'xapi-verify-test' });
    const jwt = await VC.toSignedJwt(cred, s);

    await expect(xapi.fromVerifiedJwt(jwt, null)).rejects.toThrow(/missing_jwks/);
    await expect(xapi.fromVerifiedJwt(jwt, undefined)).rejects.toThrow(/missing_jwks/);
  });

  test('rejects a JWT with no kid in header', async () => {
    // Header without kid
    const noKidHeader = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const fakePayload = Buffer.from(JSON.stringify({ vc: { credentialSubject: {} } })).toString('base64url');
    const noKidJwt = noKidHeader + '.' + fakePayload + '.sig';

    const kp = await signer.generateKeypair({ kid: 'any-key' });
    await expect(xapi.fromVerifiedJwt(noKidJwt, kp.publicKeyJwk)).rejects.toThrow(/missing_kid/);
  });

  test('rejects malformed jwt input', async () => {
    const kp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    await expect(xapi.fromVerifiedJwt('not a jwt', kp.publicKeyJwk)).rejects.toThrow(/invalid_jwt/);
    await expect(xapi.fromVerifiedJwt(null, kp.publicKeyJwk)).rejects.toThrow(/invalid_jwt/);
  });

  test('PoC: the attack pattern fromSignedJwt allows is now refused', async () => {
    // The audit PoC: an attacker hand-crafts an unsigned JWT claiming
    // `actor.account.name = 'mallory'`. fromSignedJwt happily decoded it
    // and produced a Statement. fromVerifiedJwt refuses.
    const attackerHeader = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: 'xapi-verify-test' })).toString('base64url');
    const attackerPayload = Buffer.from(JSON.stringify({
      iss: 'did:web:sws-attention-proofs.web.app',
      sub: 'did:sws:user:mallory',
      vc: {
        credentialSubject: {
          id: 'did:sws:user:mallory',
          humanVerification: { verdict: 'verified_human_active_engagement', compositeScore: 0.99 }
        }
      }
    })).toString('base64url');
    const attackerJwt = attackerHeader + '.' + attackerPayload + '.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    const legitKp = await signer.generateKeypair({ kid: 'xapi-verify-test' });
    const jwks = { keys: [legitKp.publicKeyJwk] };

    // fromSignedJwt (legacy path): would happily decode this
    const stmtUnverified = xapi.fromSignedJwt(attackerJwt);
    expect(stmtUnverified.actor.account.name).toContain('mallory'); // proves the gap

    // fromVerifiedJwt (Class 14 fix): refuses
    await expect(xapi.fromVerifiedJwt(attackerJwt, jwks)).rejects.toThrow(/jwt_invalid/);
  });
});

// ============================================================
// STRUCTURAL VALIDATION
// ============================================================

describe('xapi-adapter — validate', () => {
  test('accepts a well-formed statement', () => {
    const v = xapi.validate(xapi.fromReceipt(plausibleReceipt()));
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });

  test('rejects a statement missing the actor', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    delete stmt.actor;
    const v = xapi.validate(stmt);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('missing_actor');
  });

  test('rejects non-IRI verb id', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    stmt.verb.id = 'just-a-string';
    const v = xapi.validate(stmt);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('verb_id_not_iri');
  });

  test('rejects out-of-range score.scaled', () => {
    const stmt = xapi.fromReceipt(plausibleReceipt());
    stmt.result.score.scaled = 1.5;
    const v = xapi.validate(stmt);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('score_scaled_out_of_range');
  });
});
