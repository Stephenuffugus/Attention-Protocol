#!/usr/bin/env node
/**
 * SWS Attention Protocol — Canonical 7-Layer Fixture Generator
 *
 * Synthesizes a demo receipt that carries ALL seven attestation layers
 * populated in the signed credentialSubject, then signs it with the
 * env key. Produces proof/results/verify-sample-7layer.json — the
 * fixture to paste into verify.html when demonstrating the full stack.
 *
 * Layer coverage:
 *   1.  Environmental gate (botd@v2, bot=false, clean)
 *   2.  Behavioral composite (20 signals, composite_score 0.780)
 *   2.5 Gated final composite (auto-computed by VC builder)
 *   3a. Composition integrity (verdict=authored)
 *   3b. Honeypot canary (tripped=false, strategies attached)
 *   4.  Consent attestation (GDPR Art. 7 / CCPA §1798.120)
 *   5.  Ed25519 signature (wraps the whole credential)
 *   6a. OpenTimestamps / Bitcoin anchor (mocked bitcoin_confirmed)
 *   6b. RFC 3161 Timestamp Authority (mocked freetsa signed)
 *
 * All seven fields populate in credentialSubject. No gates trigger
 * (this is a clean-human session) so compositeScoreFinal == compositeScore.
 *
 * Requires: SWS_SIGNING_KEY + SWS_SIGNING_KID in env (or .env).
 *
 * Usage:
 *   node scripts/generate-7layer-fixture.js
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

const signer = require('../src/sdk/attention-signer');
const VC = require('../src/sdk/verifiable-credentials');

const OUT_PATH = path.join(__dirname, '..', 'proof', 'results', 'verify-sample-7layer.json');

function buildReceipt() {
  const now = new Date();
  const nowIso = now.toISOString();
  // Deterministic receipt_hash for a reproducible fixture — derive from the
  // fixed id + "clean session" semantic string so the hash is stable across
  // regenerations. This is a fixture, not a production receipt.
  const fingerprint = 'urn:sws:receipt:rcpt_7layer_canonical_clean';
  const receiptHash = crypto.createHash('sha256').update(fingerprint).digest('hex');

  return {
    receipt_id: 'rcpt_7layer_canonical_clean',
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol',
    issuer: 'SWS Strategic Media LLC',
    generated_at: nowIso,
    generated_timestamp: now.getTime(),
    subject_id: 'user_7layer_demo',
    application_id: 'canonical_demo',
    content_id: 'demo_training_module',
    content_name: 'Canonical 7-Layer Demo Session',
    engagement: {
      duration_ms: 247000,
      duration_formatted: '4 min 7 sec',
      focus_score: 78,
      quality_tier: 'deep',
      interaction_count: 63
    },
    human_verification: {
      composite_score: 0.780,
      timing_entropy: 0.81,
      fitts_compliance: 0.74,
      hicks_compliance: 0.69,
      scroll_saccade: 0.66,
      micro_pause: 0.72,
      touch_variance: 0.58,
      verdict: 'verified_human_deep_engagement'
    },
    proof: {
      hash_count: 8,
      hash_ids: ['h1','h2','h3','h4','h5','h6','h7','h8'],
      algorithm: 'SHA-256',
      receipt_hash: receiptHash
    },
    privacy: {
      no_content_recorded: true,
      no_pii_collected: true,
      no_urls_tracked: true,
      coppa_compliant: true
    },

    // --- Layer 1: Environmental gate ---
    environmental: {
      loaded: true,
      bot: false,
      bot_kind: null,
      detector: 'botd@v2',
      checked_at: nowIso,
      latency_ms: 73,
      error: null
    },

    // --- Layer 3a: Composition integrity ---
    composition_integrity: {
      detector: 'sws-composition-v1',
      composition_verdict: 'authored',
      composition_integrity_score: 0.92,
      chars_observed: 146,
      paste_burst_detected: false,
      paste_burst_count: 0,
      longest_paste_chars: 0,
      backspace_ratio: 0.082,
      backspace_suspicious: false,
      digraph_stats: {
        cv: 0.478,
        total_intervals: 133,
        subhuman_interval_count: 0
      },
      checked_at: nowIso
    },

    // --- Layer 3b: Honeypot canary (present but NOT tripped — clean session) ---
    honeypot: {
      detector: 'sws-honeypot-v1',
      canary_id: 'canary_demo_7layer_' + now.getTime().toString(36),
      tripped: false,
      verdict: 'clean',
      strategies_used: ['css_hidden_span', 'zero_width_chars', 'html_comment'],
      detection_method: null,
      injected_at: nowIso,
      checked_at: nowIso
    },

    // --- Layer 4: Consent attestation ---
    consent: {
      granted: true,
      categories: ['attention_tracking', 'behavioral_analysis'],
      timestamp: nowIso,
      version: '1.0',
      policy_url: 'https://sws-attention-proofs.web.app/privacy'
    },

    // --- Layer 6a: OpenTimestamps / Bitcoin anchor (mocked confirmed for demo) ---
    ots: {
      detector: 'opentimestamps-v1',
      status: 'bitcoin_confirmed',
      proof_b64: 'DEMO_FIXTURE_OTS_PROOF_NOT_A_REAL_BITCOIN_PROOF',
      stamped_at: nowIso,
      bitcoin_block_height: 830912,
      bitcoin_block_time: '2026-04-15T18:22:00.000Z',
      last_upgrade_check: nowIso
    },

    // --- Layer 6b: RFC 3161 Timestamp Authority (mocked signed for demo) ---
    tsa: {
      detector: 'rfc3161-tsa-v1',
      status: 'signed',
      tsa_name: 'freetsa.org',
      tsa_url: 'https://freetsa.org/tsr',
      tsa_policy_oid: '1.2.3.4.1',
      serial_hex: 'deadbeef00000001',
      gen_time: nowIso,
      hash_hex: receiptHash,
      hash_alg_oid: '2.16.840.1.101.3.4.2.1', // SHA-256 OID
      token_b64: 'DEMO_FIXTURE_RFC3161_TOKEN_NOT_A_REAL_TSA_TOKEN',
      stamped_at: nowIso
    }
  };
}

async function main() {
  const s = await signer.loadSignerFromEnv();
  if (!s) throw new Error('missing_signing_key_env');

  const receipt = buildReceipt();
  const credential = VC.fromReceipt(receipt);

  // Sanity: confirm the VC builder populated every layer field we expect
  const cs = credential.credentialSubject;
  const layerFieldsPresent = {
    environmental: !!cs.environmental,
    behavioral: typeof (cs.humanVerification && cs.humanVerification.compositeScore) === 'number',
    compositionIntegrity: !!cs.compositionIntegrity,
    honeypotCanary: !!cs.honeypotCanary,
    consentAttestation: !!cs.consentAttestation,
    bitcoinAnchor: !!cs.bitcoinAnchor,
    rfc3161Timestamp: !!cs.rfc3161Timestamp
  };
  const missing = Object.entries(layerFieldsPresent).filter(([_, ok]) => !ok).map(([k]) => k);
  if (missing.length > 0) throw new Error('missing_layer_fields: ' + missing.join(', '));

  const jwt = await VC.toSignedJwt(credential, s);

  // Roundtrip verify
  const verify = await signer.verifyJwt(jwt, s.publicKeyHex);
  if (!verify.valid) throw new Error('roundtrip_verify_failed: ' + (verify.error || 'unknown'));

  const jwtSha = crypto.createHash('sha256').update(jwt).digest('hex');

  const outer = {
    description: 'Canonical 7-layer demo fixture. Carries every attestation layer in the signed credentialSubject. Paste into verify.html for the full-stack buyer demo.',
    kid: s.kid,
    composite: receipt.human_verification.composite_score,
    compositeFinal: cs.humanVerification.compositeScoreFinal,
    jwt_sha256: jwtSha,
    signed_jwt: jwt,
    layers_present: Object.keys(layerFieldsPresent).filter(k => layerFieldsPresent[k]),
    gates_applied: cs.humanVerification.gatesApplied || [],
    note: 'The OTS proof_b64 and TSA token_b64 are placeholder strings in this fixture — they are illustrative metadata only, not real Bitcoin or TSA attestations. A real production receipt would carry verifiable proof blobs in these fields.',
    generated_at: receipt.generated_at
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(outer, null, 2) + '\n');

  console.log('Generated:', path.relative(process.cwd(), OUT_PATH));
  console.log('  kid:                 ', s.kid);
  console.log('  composite:           ', outer.composite);
  console.log('  compositeFinal:      ', outer.compositeFinal);
  console.log('  layers present (7/7):', outer.layers_present.join(', '));
  console.log('  gates applied:       ', outer.gates_applied.length);
  console.log('  roundtrip verify:    ', 'valid:true');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
