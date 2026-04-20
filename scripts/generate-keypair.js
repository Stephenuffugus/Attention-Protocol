#!/usr/bin/env node
/**
 * SWS Attention Protocol — One-time Ed25519 Keypair Generator
 *
 * Usage:
 *   node scripts/generate-keypair.js [--kid=...] [--write-jwks] [--env-out=.env]
 *
 * Flags:
 *   --kid=<id>       Override the default key ID.
 *   --write-jwks     Also write proof/.well-known/attention-pubkey.json (JWKS).
 *   --env-out=PATH  Append SWS_SIGNING_KEY= lines to this file (default: do NOT write).
 *                    When set, the private key is NEVER printed to stdout.
 *   --force          Overwrite an existing JWKS / env file without prompting.
 *
 * The private key is printed to stdout. Copy it into a .env file as:
 *   SWS_SIGNING_KEY=<hex>
 *   SWS_SIGNING_KID=<kid>
 *
 * NEVER commit the private key. .env is already gitignored.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const signer = require('../src/sdk/attention-signer');

function parseArgs(argv) {
  const args = { kid: null, writeJwks: false, force: false, envFile: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--kid=')) args.kid = a.slice(6);
    else if (a === '--write-jwks') args.writeJwks = true;
    else if (a === '--force') args.force = true;
    else if (a.startsWith('--env-out=')) args.envFile = a.slice(10);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const kp = await signer.generateKeypair(args.kid ? { kid: args.kid } : undefined);

  const jwksPath = path.resolve(__dirname, '..', 'proof', '.well-known', 'attention-pubkey.json');

  console.log('');
  console.log('==========================================================');
  console.log(' SWS Attention Protocol — Ed25519 Keypair Generated');
  console.log('==========================================================');
  console.log('');
  console.log('  Key ID (kid): ' + kp.kid);
  console.log('  Issuer:       ' + kp.issuer);
  console.log('');
  console.log('----------------------------------------------------------');
  console.log(' PUBLIC KEY (safe to commit, publish, share)');
  console.log('----------------------------------------------------------');
  console.log('  hex: ' + kp.publicKeyHex);
  console.log('  JWK: ' + JSON.stringify(kp.publicKeyJwk));
  console.log('');
  console.log('----------------------------------------------------------');
  console.log(' PRIVATE KEY — SECRET. Never commit.');
  console.log('----------------------------------------------------------');
  if (args.envFile) {
    const envPath = path.resolve(args.envFile);
    if (fs.existsSync(envPath) && !args.force) {
      // Refuse to overwrite — but we can append if there is no existing key line.
      const existing = fs.readFileSync(envPath, 'utf8');
      if (existing.includes('SWS_SIGNING_KEY=')) {
        console.log('');
        console.log(' ✗ ' + envPath + ' already contains SWS_SIGNING_KEY');
        console.log('   Re-run with --force to overwrite. (Beware — this invalidates');
        console.log('   all previously issued receipts signed with the old key.)');
        process.exit(3);
      }
    }
    const body = (fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').replace(/\n?$/, '\n') : '') +
      'SWS_SIGNING_KEY=' + kp.privateKeyHex + '\n' +
      'SWS_SIGNING_KID=' + kp.kid + '\n';
    fs.writeFileSync(envPath, body, { encoding: 'utf8', mode: 0o600 });
    console.log('');
    console.log(' ✔ Private key written to: ' + envPath + ' (mode 0600)');
    console.log('   It was NOT printed to stdout. ' + envPath + ' is gitignored.');
  } else {
    console.log('');
    console.log('  SWS_SIGNING_KEY=' + kp.privateKeyHex);
    console.log('  SWS_SIGNING_KID=' + kp.kid);
    console.log('');
  }
  console.log('----------------------------------------------------------');

  if (args.writeJwks) {
    if (fs.existsSync(jwksPath) && !args.force) {
      console.log('');
      console.log(' JWKS file already exists at:');
      console.log('   ' + jwksPath);
      console.log(' Re-run with --force to overwrite.');
      console.log('');
      process.exit(2);
    }
    fs.writeFileSync(jwksPath, JSON.stringify(kp.jwks, null, 2) + '\n', 'utf8');
    console.log('');
    console.log(' ✔ JWKS written to: ' + jwksPath);
    console.log('   Will be served at: https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json');
    console.log('');
  } else {
    console.log('');
    console.log(' To also write the JWKS file, re-run with --write-jwks');
    console.log('');
  }

  console.log(' NEXT STEPS:');
  console.log('   1. Save the SWS_SIGNING_KEY line above into .env');
  console.log('   2. Commit proof/.well-known/attention-pubkey.json');
  console.log('   3. Deploy: firebase deploy --only hosting');
  console.log('   4. Verify: curl https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json');
  console.log('');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
