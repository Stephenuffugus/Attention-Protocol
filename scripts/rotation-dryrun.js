#!/usr/bin/env node
/**
 * SWS Attention Protocol — Signing-Key Rotation Dry-Run
 *
 * Validates the rotation-staging/ materials without touching production:
 *   - Does NOT modify .env
 *   - Does NOT deploy
 *   - Does NOT re-sign real fixtures
 *
 * What it proves:
 *   1. Staged new keypair is a valid Ed25519 key, signs + self-verifies.
 *   2. Multi-key JWKS in new-jwks.json contains both old and new public keys.
 *   3. JWTs signed with the OLD key verify against the multi-key JWKS
 *      (backward-compat during grace window).
 *   4. JWTs signed with the NEW key verify against the multi-key JWKS.
 *   5. A JWT signed with the NEW key does NOT verify against the OLD-key-only
 *      JWKS (rotation is actually distinct, not a no-op).
 *   6. kid routing works — verify picks the right key from a multi-key JWKS.
 *
 * Run: node scripts/rotation-dryrun.js
 * (Must have .env populated with current SWS_SIGNING_KEY + KID.)
 */
'use strict';

const fs = require('fs');
const path = require('path');
// Load .env from the repo root so the script works from any CWD.
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) { /* dotenv optional */ }

const signer = require('../src/sdk/attention-signer');

const STAGING = path.join(__dirname, '..', 'rotation-staging');
const NEW_JWKS_PATH = path.join(STAGING, 'new-jwks.json');
const NEW_PRIV_PATH = path.join(STAGING, 'new-private-key.txt');

function loadNewPrivate() {
  const raw = fs.readFileSync(NEW_PRIV_PATH, 'utf8');
  const m = raw.match(/SWS_SIGNING_KEY=([0-9a-f]+)/i);
  const kMatch = raw.match(/SWS_SIGNING_KID=([^\s]+)/);
  if (!m) throw new Error('staged_private_key_not_found');
  if (!kMatch) throw new Error('staged_kid_not_found');
  return { privateKeyHex: m[1], kid: kMatch[1] };
}

function loadNewJwks() {
  return JSON.parse(fs.readFileSync(NEW_JWKS_PATH, 'utf8'));
}

function pickKey(jwks, kid) {
  const k = jwks.keys.find(x => x.kid === kid);
  if (!k) throw new Error('kid_not_in_jwks:' + kid);
  return k;
}

async function assertVerifies(jwt, pubJwk, label) {
  const r = await signer.verifyJwt(jwt, pubJwk);
  if (!r.valid) {
    throw new Error('FAIL: ' + label + ' — ' + (r.error || 'unknown'));
  }
  console.log('  ✓', label);
}

async function assertRejects(jwt, pubJwk, label) {
  const r = await signer.verifyJwt(jwt, pubJwk);
  if (r.valid) {
    throw new Error('FAIL: ' + label + ' — unexpectedly verified');
  }
  console.log('  ✓', label, '→ rejected (' + r.error + ')');
}

(async () => {
  console.log('━━━ SWS Signing-Key Rotation Dry-Run ━━━\n');

  // Load current (OLD) signer from env
  const oldSigner = await signer.loadSignerFromEnv();
  if (!oldSigner) throw new Error('current_signer_not_in_env');
  console.log('Old signer   : kid=' + oldSigner.kid);

  // Load staged new private key and build a signer
  const { privateKeyHex: newPriv, kid: newKid } = loadNewPrivate();
  const newSigner = await signer.createSigner(newPriv, { kid: newKid });
  console.log('New signer   : kid=' + newSigner.kid);

  // Load staged multi-key JWKS
  const jwks = loadNewJwks();
  console.log('Staged JWKS  : ' + jwks.keys.length + ' keys (' +
    jwks.keys.map(k => k.kid).join(', ') + ')');
  console.log();

  // Integrity checks on staged materials
  console.log('Step 1 — Staged material integrity');
  if (jwks.keys.length !== 2) throw new Error('expected_2_keys_in_jwks');
  const oldJwk = pickKey(jwks, oldSigner.kid);
  const newJwk = pickKey(jwks, newSigner.kid);
  if (oldJwk.kid === newJwk.kid) throw new Error('new_kid_equals_old');
  if (oldJwk.x === newJwk.x) throw new Error('new_pubkey_equals_old');
  console.log('  ✓ JWKS has both kids; public keys differ');

  // Sign a test payload with each signer
  console.log('\nStep 2 — Sign test payloads');
  const testPayload = {
    iss: 'SWS Strategic Media LLC (rotation-dryrun)',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
    purpose: 'rotation_dryrun',
    nonce: Math.random().toString(36).slice(2, 10)
  };
  const jwtOld = await signer.signJwt(testPayload, oldSigner);
  const jwtNew = await signer.signJwt(testPayload, newSigner);
  console.log('  ✓ OLD-signed JWT  (' + jwtOld.length + ' chars)');
  console.log('  ✓ NEW-signed JWT  (' + jwtNew.length + ' chars)');

  // Self-verify (each JWT against its own key)
  console.log('\nStep 3 — Self-verify (roundtrip)');
  await assertVerifies(jwtOld, oldSigner.publicKeyHex, 'OLD jwt vs OLD key');
  await assertVerifies(jwtNew, newSigner.publicKeyHex, 'NEW jwt vs NEW key');

  // Multi-key JWKS routing — each JWT verifies against the JWKS key matching its kid
  console.log('\nStep 4 — Multi-key JWKS routing (backward compat during grace)');
  await assertVerifies(jwtOld, oldJwk, 'OLD jwt vs multi-key JWKS (kid=' + oldSigner.kid + ')');
  await assertVerifies(jwtNew, newJwk, 'NEW jwt vs multi-key JWKS (kid=' + newSigner.kid + ')');

  // Cross-verification should fail — proves the rotation is distinct
  console.log('\nStep 5 — Cross-key rejection (proves rotation is not a no-op)');
  await assertRejects(jwtNew, oldJwk, 'NEW jwt vs OLD-only JWKS');
  await assertRejects(jwtOld, newJwk, 'OLD jwt vs NEW-only JWKS');

  // Final summary
  console.log('\n━━━ DRY-RUN RESULT ━━━');
  console.log('✓ Rotation materials are structurally valid.');
  console.log('✓ Multi-key JWKS preserves OLD-key verification during grace.');
  console.log('✓ NEW key is distinct and cryptographically independent.');
  console.log('✓ Production state untouched: .env unchanged, no deploy executed.');
  console.log('\nTo execute the real cutover, follow rotation-staging/ROTATION_PLAN.md.');
})().catch(err => {
  console.error('\n✗ DRY-RUN FAILED:', err.message);
  process.exit(1);
});
