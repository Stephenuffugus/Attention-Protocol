/**
 * SWS Attention Protocol — Ed25519 Signer
 *
 * Server-side signing of W3C Verifiable Credential JWTs using Ed25519 (EdDSA).
 *
 * This module is Node-only. The private key MUST NEVER ship to the browser.
 * Signing happens server-side; the browser receives the signed JWT; anyone can
 * verify with only the public key (published at
 * https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json).
 *
 * Standards:
 *   - RFC 8037 — CFRG Elliptic Curve Diffie-Hellman and Signatures in JOSE
 *   - RFC 7515 — JSON Web Signature (JWS) compact serialization
 *   - RFC 7517 — JSON Web Key (JWK)
 *   - RFC 8032 — Ed25519 signatures (EdDSA)
 *
 * Uses Node's built-in `crypto` module (OpenSSL-backed Ed25519). No external
 * dependency — works across Jest, browsers (via polyfill layer later), and
 * production Node with zero transform configuration.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const crypto = require('crypto');

const DEFAULT_KID = 'sws-attention-2026-04';
const ISSUER_DID = 'did:web:sws-attention-proofs.web.app';

// PKCS8 / SPKI DER prefixes for Ed25519 (RFC 8410).
// Used to wrap 32-byte raw keys into the form Node's crypto accepts.
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

// ============================================================
// BASE64URL (RFC 4648 §5) — required by JWT/JWS
// ============================================================

function base64urlEncode(input) {
  let b64;
  if (typeof input === 'string') {
    b64 = Buffer.from(input, 'utf8').toString('base64');
  } else {
    b64 = Buffer.from(input).toString('base64');
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input) {
  const pad = 4 - (input.length % 4);
  const padded = input + (pad < 4 ? '='.repeat(pad) : '');
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function base64urlDecodeToString(input) {
  return Buffer.from(base64urlDecode(input)).toString('utf8');
}

// ============================================================
// HEX
// ============================================================

function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new Error('invalid_hex_string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error('invalid_hex_string');
    out[i] = byte;
  }
  return out;
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

// ============================================================
// KEY OBJECT RECONSTRUCTION (from raw 32-byte seeds)
// ============================================================

function privateKeyObjectFromRaw(raw32) {
  if (raw32.length !== 32) throw new Error('invalid_private_key_length');
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(raw32)]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

function publicKeyObjectFromRaw(raw32) {
  if (raw32.length !== 32) throw new Error('invalid_public_key_length');
  const der = Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(raw32)]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

function rawPublicKeyFromObject(publicKeyObject) {
  // SPKI DER ends with 32 raw bytes of key material.
  const der = publicKeyObject.export({ type: 'spki', format: 'der' });
  return new Uint8Array(der.slice(der.length - 32));
}

function rawPrivateKeyFromObject(privateKeyObject) {
  const der = privateKeyObject.export({ type: 'pkcs8', format: 'der' });
  return new Uint8Array(der.slice(der.length - 32));
}

// ============================================================
// KEYPAIR GENERATION
// ============================================================

/**
 * Generate a fresh Ed25519 keypair using Node's OpenSSL.
 * @param {Object} opts
 * @param {string} opts.kid - Key ID (default: DEFAULT_KID)
 * @returns {Promise<{privateKeyHex, publicKeyHex, publicKeyJwk, jwks, kid, issuer}>}
 */
async function generateKeypair(opts) {
  opts = opts || {};
  const kid = opts.kid || DEFAULT_KID;

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privRaw = rawPrivateKeyFromObject(privateKey);
  const pubRaw = rawPublicKeyFromObject(publicKey);
  const publicKeyJwk = toPublicJwk(pubRaw, kid);

  return {
    privateKeyHex: bytesToHex(privRaw),
    publicKeyHex: bytesToHex(pubRaw),
    publicKeyJwk: publicKeyJwk,
    jwks: { keys: [publicKeyJwk] },
    kid: kid,
    issuer: ISSUER_DID
  };
}

/**
 * Convert 32-byte Ed25519 public key to JWK (RFC 8037).
 */
function toPublicJwk(publicKeyBytes, kid) {
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64urlEncode(publicKeyBytes),
    kid: kid || DEFAULT_KID,
    use: 'sig',
    alg: 'EdDSA'
  };
}

/**
 * Recover raw public key bytes from a JWK.
 */
function jwkToPublicKey(jwk) {
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error('invalid_jwk_not_ed25519');
  }
  return base64urlDecode(jwk.x);
}

// ============================================================
// SIGNER
// ============================================================

/**
 * Create a signer bound to a private key.
 *
 * @param {string} privateKeyHex - 64-char hex-encoded 32-byte Ed25519 seed
 * @param {Object} opts
 * @param {string} opts.kid - Key ID to embed in JWT header
 * @returns {Promise<{sign, kid, publicKeyHex, algorithm}>}
 */
async function createSigner(privateKeyHex, opts) {
  opts = opts || {};
  const kid = opts.kid || DEFAULT_KID;

  const privRaw = hexToBytes(privateKeyHex);
  const privateKeyObject = privateKeyObjectFromRaw(privRaw);
  // Derive public key for reference / JWK export
  const publicKeyObject = crypto.createPublicKey(privateKeyObject);
  const pubRaw = rawPublicKeyFromObject(publicKeyObject);

  return {
    kid: kid,
    publicKeyHex: bytesToHex(pubRaw),
    algorithm: 'EdDSA',

    /**
     * Sign a JWT signing input: Ed25519(`${headerB64}.${payloadB64}`).
     * @param {string} signingInput
     * @returns {Promise<Uint8Array>} 64-byte signature
     */
    sign: async function(signingInput) {
      const msg = Buffer.from(signingInput, 'utf8');
      // Ed25519 uses `null` algorithm in Node's crypto.sign
      const sig = crypto.sign(null, msg, privateKeyObject);
      return new Uint8Array(sig);
    }
  };
}

/**
 * Load a signer from process.env.SWS_SIGNING_KEY. Returns null if unset.
 */
async function loadSignerFromEnv() {
  const hex = process.env.SWS_SIGNING_KEY;
  if (!hex) return null;
  const kid = process.env.SWS_SIGNING_KID || DEFAULT_KID;
  return await createSigner(hex, { kid: kid });
}

// ============================================================
// JWT SIGNING (JWS Compact Serialization)
// ============================================================

/**
 * Sign a JWT payload with EdDSA.
 * @param {Object} payload - JWT claims
 * @param {Object} signer - from createSigner()
 * @returns {Promise<string>} compact JWT: header.payload.signature
 */
async function signJwt(payload, signer) {
  if (!signer || typeof signer.sign !== 'function') {
    throw new Error('missing_signer');
  }
  const header = { alg: 'EdDSA', typ: 'JWT', kid: signer.kid };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = headerB64 + '.' + payloadB64;
  const sigBytes = await signer.sign(signingInput);
  return signingInput + '.' + base64urlEncode(sigBytes);
}

// ============================================================
// VERIFICATION
// ============================================================

/**
 * Verify an EdDSA-signed JWT with a public key.
 *
 * @param {string} jwt - compact JWT
 * @param {string|Uint8Array|Object} publicKey - hex string, raw bytes, or JWK
 * @returns {Promise<{valid, header, payload, error}>}
 */
async function verifyJwt(jwt, publicKey) {
  try {
    if (typeof jwt !== 'string') {
      return { valid: false, error: 'jwt_not_string' };
    }
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'jwt_malformed' };
    }
    const [headerB64, payloadB64, sigB64] = parts;

    let header;
    try {
      header = JSON.parse(base64urlDecodeToString(headerB64));
    } catch (e) {
      return { valid: false, error: 'header_not_json' };
    }

    if (header.alg !== 'EdDSA') {
      return { valid: false, error: 'alg_not_eddsa', header: header };
    }
    if (!sigB64) {
      return { valid: false, error: 'no_signature' };
    }

    let pubKeyRaw;
    if (publicKey instanceof Uint8Array) {
      pubKeyRaw = publicKey;
    } else if (typeof publicKey === 'string') {
      pubKeyRaw = hexToBytes(publicKey);
    } else if (publicKey && typeof publicKey === 'object') {
      pubKeyRaw = jwkToPublicKey(publicKey);
    } else {
      return { valid: false, error: 'public_key_missing' };
    }

    if (pubKeyRaw.length !== 32) {
      return { valid: false, error: 'public_key_wrong_length' };
    }

    const publicKeyObject = publicKeyObjectFromRaw(pubKeyRaw);
    const signingInput = headerB64 + '.' + payloadB64;
    const msg = Buffer.from(signingInput, 'utf8');
    const sigBytes = Buffer.from(base64urlDecode(sigB64));

    // Reject non-standard signature lengths defensively
    if (sigBytes.length !== 64) {
      return { valid: false, error: 'signature_wrong_length', header: header };
    }

    const ok = crypto.verify(null, msg, publicKeyObject, sigBytes);
    if (!ok) {
      return { valid: false, error: 'signature_invalid', header: header };
    }

    let payload;
    try {
      payload = JSON.parse(base64urlDecodeToString(payloadB64));
    } catch (e) {
      return { valid: false, error: 'payload_not_json', header: header };
    }

    return { valid: true, header: header, payload: payload };
  } catch (e) {
    return { valid: false, error: 'exception: ' + (e.message || String(e)) };
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  generateKeypair,
  createSigner,
  loadSignerFromEnv,
  signJwt,
  verifyJwt,
  toPublicJwk,
  jwkToPublicKey,
  base64urlEncode,
  base64urlDecode,
  hexToBytes,
  bytesToHex,
  DEFAULT_KID,
  ISSUER_DID
};
