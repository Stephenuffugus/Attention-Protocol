#!/usr/bin/env node
/**
 * SWS Attention Protocol — OpenBadges 3.0 Issuance CLI
 *
 * Issues a signed OpenBadges 3.0 AchievementCredential from any SWS
 * signed-receipt bundle. Credly, Accredible, LinkedIn Learning, Digital
 * Promise, Sovrin wallets, and any W3C VC-capable holder can accept
 * the output directly.
 *
 * Usage:
 *   node scripts/to-openbadge.js <bundle.json> \
 *        --achievement-id=https://example.com/achievements/cme-101 \
 *        --achievement-name="Pharma Safety CME 101"              \
 *        [--description="…"]                                      \
 *        [--criteria="…"]                                         \
 *        [--tag=cme,pharma,safety]                                \
 *        [--image=https://…/badge.png]                            \
 *        [--sign]                                                 \
 *        [--out=path.json]
 *
 * Input bundle shape: any file produced by run-bot-vs-human.js or the
 * Stephen-0573-anchored artifact, i.e. { signed_jwt, ots?, ... }.
 *
 * With --sign and SWS_SIGNING_KEY in .env, the output includes a signed
 * EdDSA JWT. Without --sign, the output is the unsigned OB 3.0 JSON-LD.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ob = require('../src/sdk/open-badge');
const signer = require('../src/sdk/attention-signer');

function parseArgs(argv) {
  const args = { file: null, sign: false, out: null, achievement: {} };
  for (const a of argv.slice(2)) {
    if (a === '--sign') args.sign = true;
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '')); process.exit(0); }
    else if (a.startsWith('--out=')) args.out = a.slice(6);
    else if (a.startsWith('--achievement-id=')) args.achievement.id = a.slice(17);
    else if (a.startsWith('--achievement-name=')) args.achievement.name = a.slice(19);
    else if (a.startsWith('--description=')) args.achievement.description = a.slice(14);
    else if (a.startsWith('--criteria=')) args.achievement.criteriaNarrative = a.slice(11);
    else if (a.startsWith('--image=')) args.achievement.image = a.slice(8);
    else if (a.startsWith('--tag=')) args.achievement.tag = a.slice(6).split(',');
    else if (a.startsWith('--type=')) args.achievement.achievementType = a.slice(7);
    else if (!a.startsWith('--')) args.file = a;
  }
  return args;
}

function decodeJwtPayload(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('invalid_jwt');
  const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = 4 - (b.length % 4);
  const padded = b + (pad < 4 ? '='.repeat(pad) : '');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function receiptFromVcPayload(vc, iat) {
  const subj = vc.credentialSubject || {};
  const eng = subj.engagement || {};
  const hv = subj.humanVerification || {};
  return {
    receipt_id: vc.id || ('urn:sws:jwt:' + (iat || Date.now())),
    subject_id: subj.id || 'anonymous',
    content_id: eng.contentId || 'unknown',
    content_name: eng.contentName || '',
    generated_at: vc.issuanceDate || new Date().toISOString(),
    engagement: {
      duration_ms: eng.durationMs || 0,
      focus_score: eng.focusScore || null,
      quality_tier: eng.qualityTier || null,
      interaction_count: eng.interactionCount || 0
    },
    human_verification: {
      composite_score: typeof hv.compositeScore === 'number' ? hv.compositeScore : null,
      verdict: hv.verdict || null,
      // Round-6 fan-out: surface wall outcome in the OpenBadge
      // projection so any consumer of the open-badge credential
      // (LinkedIn, Credly, etc.) can see the trust tier alongside
      // the composite score.
      trust_tier: hv.trustTier || null,
      server_recompute: hv.serverRecompute || null,
      bounds_violations: hv.boundsViolations || null,
      trace_novelty: hv.traceNovelty || null
    },
    proof: {
      receipt_hash: (vc.proof && vc.proof.receiptHash) ||
                    (subj.attentionProof && subj.attentionProof.receiptHash) || null
    },
    ots: subj.bitcoinAnchor ? {
      status: subj.bitcoinAnchor.status,
      bitcoin_block_height: subj.bitcoinAnchor.bitcoinBlockHeight,
      proof_b64: subj.bitcoinAnchor.proofB64
    } : null
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.file || !args.achievement.id || !args.achievement.name) {
    console.error('Required: <bundle.json> --achievement-id=... --achievement-name="..."');
    console.error('Try --help for full usage.');
    process.exit(1);
  }

  let bundle;
  try {
    bundle = JSON.parse(fs.readFileSync(path.resolve(args.file), 'utf8'));
  } catch (e) {
    console.error('Could not read/parse:', args.file, '-', e.message);
    process.exit(1);
  }

  const jwt = bundle.signed_jwt || bundle.jwt;
  if (!jwt) {
    console.error('Input bundle has no signed_jwt field.');
    process.exit(1);
  }

  const payload = decodeJwtPayload(jwt);
  const vc = payload.vc;
  if (!vc) { console.error('JWT payload has no vc claim.'); process.exit(1); }

  const receipt = receiptFromVcPayload(vc, payload.iat);
  const achievement = ob.createAchievement(args.achievement);
  const obCred = ob.fromReceipt(receipt, achievement, { signedReceiptJwt: jwt });

  const v = ob.validate(obCred);
  if (!v.valid) {
    console.error('OpenBadge credential failed structural validation:', v.errors.join(', '));
    process.exit(2);
  }

  let output;
  if (args.sign) {
    const s = await signer.loadSignerFromEnv();
    if (!s) {
      console.error('--sign requested but SWS_SIGNING_KEY not in .env.');
      process.exit(1);
    }
    const signedJwt = await ob.toSignedJwt(obCred, s);
    output = {
      achievement_id: achievement.id,
      achievement_name: achievement.name,
      openbadge_credential: obCred,
      signed_jwt: signedJwt,
      issuer: ob.ISSUER_DID,
      public_key_url: 'https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json',
      verify_page: 'https://sws-attention-proofs.web.app/verify.html',
      issued_at: new Date().toISOString()
    };
  } else {
    output = {
      achievement_id: achievement.id,
      achievement_name: achievement.name,
      openbadge_credential: obCred
    };
  }

  const json = JSON.stringify(output, null, 2) + '\n';
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), json);
    console.error('Wrote: ' + args.out);
  } else {
    process.stdout.write(json);
  }
}

main().catch(e => { console.error('ERROR:', e && e.message); process.exit(1); });
