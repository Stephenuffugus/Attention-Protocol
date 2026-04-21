#!/usr/bin/env node
/**
 * SWS Attention Protocol — Demo Fixture Refresher
 *
 * Re-signs the canonical demo fixtures so they stay (a) unexpired and
 * (b) up to date with the current SDK (specifically, carrying the
 * receipt-wide gated composite fields shipped 2026-04-21).
 *
 * Fixtures handled:
 *   proof/results/humanness-sample.json     — time-sensitive (24h validity)
 *   proof/results/verify-sample-6layer.json — canonical pitch fixture, not time-bumped
 *
 * Requires: SWS_SIGNING_KEY + SWS_SIGNING_KID in env (or .env).
 *
 * Usage:
 *   node scripts/refresh-demo-fixtures.js
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

const signer = require('../src/sdk/attention-signer');
const receiptComposite = require('../src/sdk/receipt-composite');

const HUMANNESS_PATH = path.join(__dirname, '..', 'proof', 'results', 'humanness-sample.json');
const VERIFY6_PATH = path.join(__dirname, '..', 'proof', 'results', 'verify-sample-6layer.json');
const VALIDITY_MS = 24 * 60 * 60 * 1000;

function decodePayload(jwt) {
  const p = jwt.split('.')[1];
  return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
}

/**
 * Ensure humanVerification carries compositeScoreFinal + qualityTierFinal +
 * gatesApplied, derived from the credentialSubject's current env/composition
 * state. Idempotent: recomputes from scratch even if fields already present.
 */
function injectGatedComposite(vc) {
  const cs = vc && vc.credentialSubject;
  if (!cs || !cs.humanVerification) return { added: false, reason: 'no_humanVerification' };
  const hv = cs.humanVerification;
  const bc = typeof hv.compositeScore === 'number' ? hv.compositeScore : 0;

  const envInput = cs.environmental
    ? { loaded: cs.environmental.loaded, bot: cs.environmental.bot, botKind: cs.environmental.botKind }
    : null;
  const ciInput = cs.compositionIntegrity
    ? { verdict: cs.compositionIntegrity.verdict, score: cs.compositionIntegrity.score }
    : null;
  const hpInput = cs.honeypotCanary
    ? { tripped: !!cs.honeypotCanary.tripped }
    : null;

  const gated = receiptComposite.computeFinalComposite({
    behavioralComposite: bc,
    environmental: envInput,
    compositionIntegrity: ciInput,
    honeypot: hpInput
  });
  hv.compositeScoreFinal = gated.finalComposite;
  hv.qualityTierFinal = gated.tierFinal;
  hv.gatesApplied = gated.gatesApplied;
  hv.compositeGateVersion = gated.version;
  return {
    added: true,
    behavioral: bc,
    final: gated.finalComposite,
    tier: gated.tierFinal,
    gatesApplied: gated.gatesApplied.length
  };
}

async function reSign(payload, s) {
  const fresh = await signer.signJwt(payload, s);
  const roundtrip = await signer.verifyJwt(fresh, s.publicKeyHex);
  if (!roundtrip.valid) {
    throw new Error('roundtrip_verify_failed: ' + (roundtrip.error || 'unknown'));
  }
  return fresh;
}

async function refreshHumanness(s) {
  if (!fs.existsSync(HUMANNESS_PATH)) {
    throw new Error('fixture_missing: ' + HUMANNESS_PATH);
  }
  const outer = JSON.parse(fs.readFileSync(HUMANNESS_PATH, 'utf8'));
  const payload = decodePayload(outer.signed_jwt);

  const now = new Date();
  const nowIso = now.toISOString();
  const expiry = new Date(now.getTime() + VALIDITY_MS);
  const expiryIso = expiry.toISOString();

  payload.iat = Math.floor(now.getTime() / 1000);
  payload.exp = Math.floor(expiry.getTime() / 1000);

  const vc = payload.vc;
  vc.issuanceDate = nowIso;
  vc.validFrom = nowIso;
  vc.validUntil = expiryIso;
  if (vc.proof) vc.proof.created = nowIso;

  const cs = vc.credentialSubject || {};
  if (cs.consentAttestation) cs.consentAttestation.grantedAt = nowIso;
  if (cs.compositionIntegrity) cs.compositionIntegrity.checkedAt = nowIso;
  if (cs.environmental) cs.environmental.checkedAt = nowIso;

  const gateInfo = injectGatedComposite(vc);

  const fresh = await reSign(payload, s);
  const next = {
    signed_jwt: fresh,
    generated_at: nowIso,
    valid_until: expiryIso,
    kid: s.kid
  };
  fs.writeFileSync(HUMANNESS_PATH, JSON.stringify(next, null, 2) + '\n');
  return { path: HUMANNESS_PATH, issuedAt: nowIso, expiresAt: expiryIso, kid: s.kid, gate: gateInfo };
}

async function upgradeVerifySample6Layer(s) {
  if (!fs.existsSync(VERIFY6_PATH)) {
    throw new Error('fixture_missing: ' + VERIFY6_PATH);
  }
  const outer = JSON.parse(fs.readFileSync(VERIFY6_PATH, 'utf8'));
  const payload = decodePayload(outer.signed_jwt);
  const gateInfo = injectGatedComposite(payload.vc);
  const fresh = await reSign(payload, s);
  outer.signed_jwt = fresh;
  outer.kid = s.kid;
  // Recompute jwt_sha256 since the payload changed
  const crypto = require('crypto');
  outer.jwt_sha256 = crypto.createHash('sha256').update(fresh).digest('hex');
  fs.writeFileSync(VERIFY6_PATH, JSON.stringify(outer, null, 2) + '\n');
  return { path: VERIFY6_PATH, kid: s.kid, gate: gateInfo };
}

(async () => {
  const s = await signer.loadSignerFromEnv();
  if (!s) throw new Error('missing_signing_key_env');

  const h = await refreshHumanness(s);
  console.log('Refreshed:', path.relative(process.cwd(), h.path));
  console.log('  kid:        ', h.kid);
  console.log('  issued at:  ', h.issuedAt);
  console.log('  expires at: ', h.expiresAt);
  console.log('  gated:      ', h.gate.added
    ? 'behavioral=' + h.gate.behavioral.toFixed(3) + ' final=' + h.gate.final.toFixed(3) + ' tier=' + h.gate.tier + ' gates=' + h.gate.gatesApplied
    : 'skipped (' + h.gate.reason + ')');
  console.log('  roundtrip:   valid:true');

  const v = await upgradeVerifySample6Layer(s);
  console.log('\nUpgraded:', path.relative(process.cwd(), v.path));
  console.log('  kid:        ', v.kid);
  console.log('  gated:      ', v.gate.added
    ? 'behavioral=' + v.gate.behavioral.toFixed(3) + ' final=' + v.gate.final.toFixed(3) + ' tier=' + v.gate.tier + ' gates=' + v.gate.gatesApplied
    : 'skipped (' + v.gate.reason + ')');
  console.log('  roundtrip:   valid:true');
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
