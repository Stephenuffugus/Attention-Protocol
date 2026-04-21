#!/usr/bin/env node
/**
 * SWS Attention Protocol — Ed25519 Signing Key Rotation
 *
 * STAGED rotation: generates a new keypair, produces a multi-key JWKS
 * that carries BOTH the current and new public keys (so legacy receipts
 * remain verifiable under their original kid), writes everything to
 * ./rotation-staging/ for review. Does NOT mutate live .env or the
 * deployed JWKS without explicit cutover.
 *
 * Why:
 *   The current SWS_SIGNING_KEY surfaced in session diagnostics on
 *   2026-04-21. Rotation is precautionary — no evidence of external
 *   exposure, but best practice is to rotate after any in-session leak.
 *
 * Usage:
 *   node scripts/rotate-signing-key.js
 *     → writes rotation-staging/{new-private-key.txt, new-jwks.json,
 *                                 new-env-block.txt, ROTATION_PLAN.md}
 *     → makes NO destructive changes
 *
 * Cutover (when ready — separate manual steps):
 *   1. Replace proof/.well-known/attention-pubkey.json with
 *      rotation-staging/new-jwks.json
 *   2. Deploy proof/ to Firebase (firebase deploy --only hosting on
 *      project sws-attention-proofs)
 *   3. Wait until the live JWKS at sws-attention-proofs.web.app
 *      reflects the new keys (curl /.well-known/attention-pubkey.json)
 *   4. Replace the SWS_SIGNING_KEY value in .env with the new one
 *      (from rotation-staging/new-private-key.txt)
 *   5. Update SWS_SIGNING_KID in .env to the new kid
 *   6. Run `node scripts/refresh-demo-fixtures.js` to re-sign fixtures
 *      under the new kid (old fixtures remain verifiable because the
 *      OLD kid is still published in the JWKS for backward compat)
 *   7. Once you're satisfied everything works, REVOKE the old key by
 *      removing it from the JWKS in a follow-up deploy. Typical
 *      grace period: 7 days (long enough for any in-flight verifiers
 *      to refetch the JWKS).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) {}

const signer = require('../src/sdk/attention-signer');

const STAGING_DIR = path.join(__dirname, '..', 'rotation-staging');
const LIVE_JWKS_PATH = path.join(__dirname, '..', 'proof', '.well-known', 'attention-pubkey.json');

function isoDateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
}

async function main() {
  if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true });

  const oldKid = process.env.SWS_SIGNING_KID || 'sws-attention-2026-04';
  const newKid = oldKid.replace(/(-v\d+)?$/, '') + '-v2';

  // Generate new keypair
  const kp = await signer.generateKeypair({ kid: newKid });

  // Read the current live JWKS so we can merge the new key alongside the old
  let liveJwks = { keys: [] };
  if (fs.existsSync(LIVE_JWKS_PATH)) {
    liveJwks = JSON.parse(fs.readFileSync(LIVE_JWKS_PATH, 'utf8'));
  }

  // Build multi-key JWKS: keep all existing keys, add the new one
  const mergedJwks = {
    keys: [
      ...liveJwks.keys.map(k => ({ ...k })), // preserve old keys verbatim
      kp.publicKeyJwk
    ]
  };

  // Write staging artifacts
  fs.writeFileSync(
    path.join(STAGING_DIR, 'new-private-key.txt'),
    `# SWS signing key rotation artifacts — staged ${new Date().toISOString()}\n` +
    `# DO NOT COMMIT THIS FILE — ensure it stays gitignored under rotation-staging/\n\n` +
    `SWS_SIGNING_KEY=${kp.privateKeyHex}\n` +
    `SWS_SIGNING_KID=${newKid}\n`
  );
  fs.writeFileSync(path.join(STAGING_DIR, 'new-jwks.json'), JSON.stringify(mergedJwks, null, 2) + '\n');

  // Env-block Stephen will paste into .env (replaces existing two lines)
  fs.writeFileSync(
    path.join(STAGING_DIR, 'new-env-block.txt'),
    `# Paste over the existing SWS_SIGNING_KEY and SWS_SIGNING_KID lines in .env:\n` +
    `SWS_SIGNING_KEY=${kp.privateKeyHex}\n` +
    `SWS_SIGNING_KID=${newKid}\n`
  );

  // Plan doc
  const plan = [
    '# Signing Key Rotation — Cutover Plan',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Old kid:   ${oldKid}`,
    `New kid:   ${newKid}`,
    `Old keys in JWKS: ${liveJwks.keys.length} (retained for backward compatibility)`,
    `New keys in JWKS: ${mergedJwks.keys.length} (old + 1 new)`,
    '',
    '## Files staged',
    '',
    '- `rotation-staging/new-jwks.json` — multi-key JWKS (old + new public keys)',
    '- `rotation-staging/new-private-key.txt` — new private key for .env',
    '- `rotation-staging/new-env-block.txt` — env block to paste over existing two lines',
    '',
    '## Cutover steps (execute when ready)',
    '',
    '1. **Deploy the new JWKS:**',
    '   ```bash',
    '   cp rotation-staging/new-jwks.json proof/.well-known/attention-pubkey.json',
    '   firebase deploy --only hosting --project sws-attention-proofs',
    '   ```',
    '   Wait for deploy to finish.',
    '',
    '2. **Verify the deploy landed:**',
    '   ```bash',
    `   curl -s https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json | jq '.keys | length'`,
    `   # should print ${mergedJwks.keys.length}`,
    '   ```',
    '',
    '3. **Update .env** — open `.env` in VS Code, replace the top two lines',
    '   with the contents of `rotation-staging/new-env-block.txt`.',
    '',
    '4. **Re-sign fixtures under the new kid:**',
    '   ```bash',
    '   node scripts/refresh-demo-fixtures.js',
    '   ```',
    '',
    '5. **Verify new fixtures validate against live JWKS:**',
    '   ```bash',
    '   curl -s https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json > /tmp/jwks.json',
    `   # pick any fixture, verify — existing canonical-fixtures.test.js already covers this`,
    '   npx jest tests/canonical-fixtures.test.js',
    '   ```',
    '',
    '6. **Grace period + revoke old key (7 days later):**',
    '   After ~7 days, remove the old key from the JWKS and redeploy:',
    '   ```bash',
    `   jq '{ keys: [.keys[] | select(.kid != "${oldKid}")] }' proof/.well-known/attention-pubkey.json > /tmp/jwks-new.json`,
    '   mv /tmp/jwks-new.json proof/.well-known/attention-pubkey.json',
    '   firebase deploy --only hosting --project sws-attention-proofs',
    '   ```',
    '',
    '## Rollback',
    '',
    'Until step 3 executes (`.env` update), nothing has changed operationally.',
    'To roll back: delete `rotation-staging/` and discard the staged JWKS diff.',
    '',
    'After step 3, rollback means pasting the OLD env-block back and redeploying',
    'the OLD single-key JWKS. Since the OLD key is still in the deployed JWKS',
    'throughout the grace period, receipts signed under either kid verify.',
    '',
    `**Last updated:** ${new Date().toISOString().slice(0,10)}`,
    ''
  ].join('\n');

  fs.writeFileSync(path.join(STAGING_DIR, 'ROTATION_PLAN.md'), plan);

  console.log('Staged rotation artifacts in', path.relative(process.cwd(), STAGING_DIR));
  console.log('  new-jwks.json       ', mergedJwks.keys.length, 'keys (old + new)');
  console.log('  new-private-key.txt  (not committed — gitignored via /rotation-staging/)');
  console.log('  new-env-block.txt   ');
  console.log('  ROTATION_PLAN.md    ', 'step-by-step cutover');
  console.log('');
  console.log('Nothing live has changed. Review ROTATION_PLAN.md and execute steps manually when ready.');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
