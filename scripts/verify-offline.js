#!/usr/bin/env node
/**
 * SWS Attention Protocol — Cold-Start Offline Verification
 *
 * Proves the "SCIF-compatible" claim: a buyer can verify a signed attention
 * receipt with ZERO network access, using only:
 *   - a receipt JWT (.json file or raw compact JWT string)
 *   - a public-key JWKS (.json file)
 *   - Node's built-in crypto (no external dependencies)
 *
 * Nothing is fetched over the network. No calls to any SWS server.
 * No reference to anything outside the two files you hand this script.
 *
 * Usage:
 *   node scripts/verify-offline.js <jwt_or_json_path> <jwks_path>
 *
 * Examples:
 *   # Verify a live fixture against the deployed public key
 *   node scripts/verify-offline.js \
 *     proof/results/humanness-sample.json \
 *     proof/.well-known/attention-pubkey.json
 *
 *   # Verify a raw compact JWT string
 *   node scripts/verify-offline.js "eyJhbGci..." ./my-jwks.json
 *
 * Exit codes:
 *   0  verified (signature valid, kid matched a key in JWKS)
 *   1  invalid signature or malformed input
 *   2  expired (signature valid but past exp — included for audit use-cases
 *      where you still want to see the cryptographic verdict separately)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fatal(msg, code) {
  console.error('✗ ' + msg);
  process.exit(code || 1);
}

function base64urlToBuffer(s) {
  const pad = (4 - s.length % 4) % 4;
  const b64 = (s + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function loadJwtArg(arg) {
  // If it looks like a path to a file, read the file. Otherwise treat as JWT.
  if (fs.existsSync(arg)) {
    const raw = fs.readFileSync(arg, 'utf8').trim();
    // File may be raw JWT or a wrapper JSON like {signed_jwt: "..."}
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.signed_jwt === 'string') return parsed.signed_jwt;
      if (typeof parsed.jwt === 'string') return parsed.jwt;
      fatal('JWT file is JSON but has no signed_jwt/jwt field');
    }
    return raw;
  }
  return arg;
}

function loadJwks(p) {
  if (!fs.existsSync(p)) fatal('JWKS file not found: ' + p);
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!parsed || !Array.isArray(parsed.keys)) {
    fatal('JWKS file malformed — missing keys[] array');
  }
  return parsed.keys;
}

// Convert an Ed25519 JWK to a Node KeyObject (uses only Node built-ins, no deps).
function jwkToNodeKey(jwk) {
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    fatal('unsupported key type — expected OKP/Ed25519, got ' + jwk.kty + '/' + jwk.crv);
  }
  const xRaw = base64urlToBuffer(jwk.x);
  if (xRaw.length !== 32) fatal('Ed25519 public key must be 32 bytes');
  // Wrap raw Ed25519 pubkey in the DER SubjectPublicKeyInfo envelope that
  // Node's createPublicKey() accepts.
  const derPrefix = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  const der = Buffer.concat([derPrefix, xRaw]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

const [,, jwtArg, jwksArg] = process.argv;
if (!jwtArg || !jwksArg) {
  console.log('Usage: node scripts/verify-offline.js <jwt_or_json_path> <jwks_path>');
  process.exit(1);
}

console.log('━━━ SWS Offline Receipt Verification ━━━');
console.log('Using: Node built-in crypto only. Zero network calls.\n');

// Step 1: Read both files off disk. This is the ONLY I/O.
const jwt = loadJwtArg(jwtArg);
const keys = loadJwks(path.resolve(jwksArg));
console.log('Input — JWT:        ' + (jwt.length) + ' chars');
console.log('Input — JWKS keys:  ' + keys.length + ' (kids: ' + keys.map(k => k.kid).join(', ') + ')');

// Step 2: Split JWT, decode header.
const parts = jwt.split('.');
if (parts.length !== 3) fatal('malformed JWT — expected 3 parts, got ' + parts.length);
const [headerB64, payloadB64, sigB64] = parts;
const header = JSON.parse(base64urlToBuffer(headerB64).toString('utf8'));
console.log('\nStep 1 — JWT header');
console.log('  alg: ' + header.alg);
console.log('  kid: ' + header.kid);
console.log('  typ: ' + header.typ);

if (header.alg !== 'EdDSA') fatal('unexpected algorithm: ' + header.alg + ' (expected EdDSA)');
if (!header.kid) fatal('JWT header missing kid');

// Step 3: Find the matching JWK by kid.
const jwk = keys.find(k => k.kid === header.kid);
if (!jwk) fatal('no key in JWKS matches kid=' + header.kid);
console.log('\nStep 2 — JWKS key match');
console.log('  ✓ Found key for kid=' + header.kid);

// Step 4: Verify the signature using Node's built-in Ed25519.
const pubKey = jwkToNodeKey(jwk);
const signingInput = Buffer.from(headerB64 + '.' + payloadB64, 'utf8');
const signature = base64urlToBuffer(sigB64);
const sigValid = crypto.verify(null, signingInput, pubKey, signature);
console.log('\nStep 3 — Ed25519 signature verification');
console.log('  ' + (sigValid ? '✓ VALID' : '✗ INVALID'));
if (!sigValid) fatal('Signature did not verify against the JWK', 1);

// Step 5: Decode payload + check exp (informational — not a hard fail).
const payload = JSON.parse(base64urlToBuffer(payloadB64).toString('utf8'));
const nowSec = Math.floor(Date.now() / 1000);
const expStatus = typeof payload.exp === 'number'
  ? (nowSec > payload.exp + 300 ? 'EXPIRED' : 'within validity window')
  : 'no exp claim';
console.log('\nStep 4 — Claims');
console.log('  issuer:       ' + (payload.iss || '(none)'));
console.log('  subject:      ' + (payload.sub || '(none)'));
console.log('  issuedAt:     ' + (payload.iat ? new Date(payload.iat * 1000).toISOString() : '(none)'));
console.log('  expires:      ' + (payload.exp ? new Date(payload.exp * 1000).toISOString() : '(none)') + ' — ' + expStatus);
if (payload.vc && payload.vc.credentialSubject) {
  const cs = payload.vc.credentialSubject;
  if (cs.humanVerification) {
    console.log('  composite:    ' + (cs.humanVerification.compositeScore ?? '(none)'));
    console.log('  tier:         ' + (cs.humanVerification.qualityTier || cs.humanVerification.qualityTierFinal || '(none)'));
    if (typeof cs.humanVerification.compositeScoreFinal === 'number') {
      console.log('  gatedFinal:   ' + cs.humanVerification.compositeScoreFinal + '  (after defense-in-depth gates)');
    }
  }
}

// Step 6: Verdict.
console.log('\n━━━ VERIFICATION RESULT ━━━');
if (expStatus === 'EXPIRED') {
  console.log('⚠ Cryptographically authentic, but outside freshness window.');
  console.log('  Use case: audit / replay. Use case: NOT humanness-presentation.');
  process.exit(2);
}
console.log('✓ Receipt is authentic (Ed25519 signature valid) and within its freshness window.');
console.log('  Verified using Node built-in crypto + two local files. No network involved.');
