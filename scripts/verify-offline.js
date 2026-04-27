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

// Step 5: Decode payload + run the full claim-error block. Round-4
// fan-out: previously this script only soft-checked `exp` (informational,
// non-fatal). That made it materially weaker than verify.html /
// prove-humanness.html / the Node-side signer — and SCIF / cold-storage
// reviewers were the audience for whom strictness most matters. Now
// mirrors the verify.html block: enforce iss / nbf / iat against the
// kid's validity window; surface gatesOverridden and calibration_override
// as decision-grade-rejecting warnings.
const payload = JSON.parse(base64urlToBuffer(payloadB64).toString('utf8'));
const nowSec = Math.floor(Date.now() / 1000);
const CLOCK_SKEW_SEC = 300;
const ACCEPTED_ISSUERS = new Set([
  'did:web:sws-attention-proofs.web.app'
  // did:web:localhost intentionally NOT included — cold-storage / SCIF
  // verifier should never accept dev-issued receipts.
]);
const claimErrors = [];

if (typeof payload.exp === 'number' && nowSec > payload.exp + CLOCK_SKEW_SEC) {
  claimErrors.push('expired (exp=' + new Date(payload.exp * 1000).toISOString() + ')');
}
if (typeof payload.nbf === 'number' && nowSec + CLOCK_SKEW_SEC < payload.nbf) {
  claimErrors.push('not_yet_valid (nbf=' + new Date(payload.nbf * 1000).toISOString() + ')');
}
if (payload.iss && !ACCEPTED_ISSUERS.has(payload.iss)) {
  claimErrors.push('unknown_issuer (' + payload.iss + ')');
}
const vcIssuerId = payload.vc && payload.vc.issuer && payload.vc.issuer.id;
if (vcIssuerId && payload.iss && vcIssuerId !== payload.iss) {
  claimErrors.push('iss_vc_issuer_mismatch');
}
// Mandatory per-kid validity window (mirrors verify.html R3-NEW-2/3).
if (!jwk.sws_validFrom || !jwk.sws_validUntil) {
  claimErrors.push('kid_missing_validity_window (kid=' + jwk.kid + ')');
} else {
  const vfMs = Date.parse(jwk.sws_validFrom);
  const vuMs = Date.parse(jwk.sws_validUntil);
  if (!Number.isFinite(vfMs)) claimErrors.push('jwk_validFrom_unparseable');
  if (!Number.isFinite(vuMs)) claimErrors.push('jwk_validUntil_unparseable');
  if (typeof payload.iat === 'number' && Number.isFinite(vfMs) && Number.isFinite(vuMs)) {
    const iatMs = payload.iat * 1000;
    if (iatMs + CLOCK_SKEW_SEC * 1000 < vfMs) claimErrors.push('iat_before_kid_validFrom');
    if (iatMs > vuMs + CLOCK_SKEW_SEC * 1000) claimErrors.push('iat_after_kid_validUntil');
  }
}

console.log('\nStep 4 — Claims');
console.log('  issuer:       ' + (payload.iss || '(none)'));
console.log('  subject:      ' + (payload.sub || '(none)'));
console.log('  issuedAt:     ' + (payload.iat ? new Date(payload.iat * 1000).toISOString() : '(none)'));
console.log('  expires:      ' + (payload.exp ? new Date(payload.exp * 1000).toISOString() : '(none)'));
if (payload.vc && payload.vc.credentialSubject) {
  const cs = payload.vc.credentialSubject;
  if (cs.humanVerification) {
    console.log('  composite:    ' + (cs.humanVerification.compositeScore ?? '(none)'));
    console.log('  tier:         ' + (cs.humanVerification.qualityTier || cs.humanVerification.qualityTierFinal || '(none)'));
    if (typeof cs.humanVerification.compositeScoreFinal === 'number') {
      console.log('  gatedFinal:   ' + cs.humanVerification.compositeScoreFinal + '  (after defense-in-depth gates)');
    }
    if (cs.humanVerification.gatesOverridden === true) {
      claimErrors.push('gates_overridden_by_issuer (decision-grade verifiers should reject)');
    }
    // R2-NEW-2 / "THE WALL" surfacing: hard-reject if the issuer's
    // server-side recompute flagged divergence or plausibility bounds
    // were violated. This is the SCIF / cold-storage verifier; it
    // should be the strictest of the three surfaces.
    if (cs.humanVerification.trustTier === 'client_attested_bounds_violated') {
      claimErrors.push('trust_tier:client_attested_bounds_violated (' +
        ((cs.humanVerification.boundsViolations || []).join(';')) + ')');
    }
    const sr = cs.humanVerification.serverRecompute;
    if (sr && sr.divergent === true) {
      claimErrors.push('server_recompute_divergent:client=' + sr.client_composite +
                       ',server=' + sr.server_composite);
    }
    if (cs.humanVerification.trustTier === 'server_attested') {
      console.log('  trustTier:    server_attested (R2-NEW-2 recompute matched)');
    } else if (cs.humanVerification.trustTier) {
      console.log('  trustTier:    ' + cs.humanVerification.trustTier);
    }
  }
  if (cs.conformalAnalysis && cs.conformalAnalysis.calibration) {
    if (cs.conformalAnalysis.calibration.calibration_override === true) {
      claimErrors.push('calibration_override (decision-grade verifiers should reject)');
    }
    if (cs.conformalAnalysis.calibration.small_n_caveat === true) {
      claimErrors.push('small_n_caveat (CI is approximate; OK for forensic, NOT decision-grade)');
    }
  }
}

// Step 6: Verdict.
console.log('\n━━━ VERIFICATION RESULT ━━━');
if (claimErrors.length > 0) {
  console.log('⚠ Cryptographically authentic, BUT failed one or more claim checks:');
  for (const e of claimErrors) console.log('  ✗ ' + e);
  console.log('\n  Use case: audit / forensic / replay. NOT decision-grade.');
  process.exit(2);
}
console.log('✓ Receipt is authentic (Ed25519 signature valid) and passes ALL claim checks.');
console.log('  Verified using Node built-in crypto + two local files. No network involved.');
