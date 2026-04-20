/**
 * SWS Attention Protocol — OpenBadges 3.0 Issuer
 *
 * Wraps a signed SWS attention receipt as a 1EdTech OpenBadges 3.0
 * AchievementCredential. Any OB 3.0 verifier (Credly, LinkedIn Learning,
 * Accredible, Digital Promise, Sovrin wallets, any W3C VC-capable holder)
 * can consume the output.
 *
 * Standards:
 *   - OpenBadges 3.0 — https://www.imsglobal.org/spec/ob/v3p0/ (1EdTech)
 *   - W3C Verifiable Credentials Data Model 2.0 — https://www.w3.org/TR/vc-data-model-2.0/
 *   - RFC 8037 (Ed25519 in JOSE) + RFC 7515 (JWS)
 *
 * Design:
 *   - An OB 3.0 credential is a W3C VC with type
 *       ["VerifiableCredential", "OpenBadgeCredential"]
 *     and the OB 3.0 JSON-LD context on top of the VC context.
 *   - credentialSubject.achievement describes the thing earned.
 *   - result[] holds the evidence signals (the attention composite).
 *   - evidence[] holds the full signed SWS receipt JWT, so any downstream
 *     system can re-verify the Ed25519 signature at any point.
 *
 * Privacy:
 *   - credentialSubject.id is a pseudonymous did:sws:user: by default.
 *   - No email / name / phone is inferred from the receipt. Callers may
 *     pass opts.recipient = {type, identityHash, identityType: 'emailSha256'}
 *     for the OB 3.0 "identity hash" pattern if the relying party needs
 *     verifiable linkage to a user identity — but we never emit the raw
 *     email, only a SHA-256 hash with salt at the caller's discretion.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const OB3_CONTEXT = 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json';
const ISSUER_DID = 'did:web:sws-attention-proofs.web.app';
const ISSUER_NAME = 'SWS Strategic Media LLC';
const ISSUER_URL = 'https://sws-attention-proofs.web.app';

// ============================================================
// ACHIEVEMENT BUILDER
// ============================================================

/**
 * Build an OB 3.0 Achievement descriptor — the "thing earned."
 *
 * @param {Object} opts
 * @param {string} opts.id - fully-qualified IRI for the achievement
 * @param {string} opts.name - human-readable name
 * @param {string} [opts.description]
 * @param {string} [opts.criteriaNarrative] - what earns this achievement
 * @param {string[]} [opts.tag]
 * @param {string} [opts.achievementType='Achievement']  (or 'Certification', 'MicroCredential', ...)
 * @param {string} [opts.image] - URL to badge image PNG/SVG
 * @returns {Object} OB 3.0 Achievement
 */
function createAchievement(opts) {
  opts = opts || {};
  if (!opts.id || !opts.name) {
    throw new Error('achievement_requires_id_and_name');
  }
  const ach = {
    id: opts.id,
    type: ['Achievement'],
    name: opts.name,
    criteria: {
      narrative: opts.criteriaNarrative || 'Completion with verified human attention per SWS Proof of Attention Protocol.'
    }
  };
  if (opts.description) ach.description = opts.description;
  if (opts.tag && opts.tag.length) ach.tag = opts.tag.slice();
  if (opts.image) ach.image = { id: opts.image, type: 'Image' };
  if (opts.achievementType && opts.achievementType !== 'Achievement') {
    ach.achievementType = opts.achievementType;
  }
  return ach;
}

// ============================================================
// CREDENTIAL BUILDER
// ============================================================

/**
 * Build an OB 3.0 AchievementCredential from an SWS attention receipt.
 *
 * @param {Object} receipt - from SWSReceipts.generateReceipt
 * @param {Object} achievement - from createAchievement()
 * @param {Object} [opts]
 * @param {string} [opts.signedReceiptJwt] - attach as evidence
 * @param {string} [opts.subjectDid] - override the auto-derived subject DID
 * @param {Object} [opts.recipient] - {identityHash, identityType, salt} — OB 3.0 identity hash
 * @returns {Object} OB 3.0 VC (unsigned)
 */
function fromReceipt(receipt, achievement, opts) {
  opts = opts || {};
  if (!receipt) throw new Error('openbadge_missing_receipt');
  if (!achievement || !achievement.id) throw new Error('openbadge_missing_achievement');

  const subjectDid = opts.subjectDid || _deriveSubjectDid(receipt.subject_id);

  const credentialSubject = {
    type: ['AchievementSubject'],
    id: subjectDid,
    achievement: achievement
  };

  // Identity hash pattern (OB 3.0 §8.1) — only include if caller explicitly provides.
  if (opts.recipient && opts.recipient.identityHash) {
    credentialSubject.identifier = [{
      type: 'IdentityObject',
      hashed: true,
      identityHash: opts.recipient.identityHash,
      identityType: opts.recipient.identityType || 'emailSha256',
      salt: opts.recipient.salt || undefined
    }];
  }

  // Result — the quantitative evidence from the attention receipt.
  const hv = receipt.human_verification || {};
  if (typeof hv.composite_score === 'number') {
    credentialSubject.result = [{
      type: ['Result'],
      value: String(hv.composite_score),
      resultDescription: 'urn:sws:result:behavioral-composite'
    }];
    if (typeof hv.verdict === 'string') {
      credentialSubject.result.push({
        type: ['Result'],
        status: hv.verdict
      });
    }
  }

  const cred = {
    '@context': [VC_CONTEXT, OB3_CONTEXT],
    id: 'urn:sws:openbadge:' + (receipt.receipt_id || ('anon_' + Date.now())),
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: ISSUER_DID,
      type: ['Profile'],
      name: ISSUER_NAME,
      url: ISSUER_URL
    },
    validFrom: receipt.generated_at || new Date().toISOString(),
    issuanceDate: receipt.generated_at || new Date().toISOString(),
    credentialSubject: credentialSubject
  };

  // Evidence — the underlying signed SWS receipt, so any verifier can
  // re-check the Ed25519 signature of the attention data.
  const evidence = [];
  if (opts.signedReceiptJwt) {
    evidence.push({
      id: 'urn:sws:evidence:receipt:' + receipt.receipt_id,
      type: ['Evidence'],
      narrative: 'SWS signed attention receipt (VC-JWT, EdDSA). Verify offline against ' + ISSUER_URL + '/.well-known/attention-pubkey.json.',
      signedReceiptJwt: opts.signedReceiptJwt,
      genre: 'attention_attestation'
    });
  }
  if (receipt.proof && receipt.proof.receipt_hash) {
    evidence.push({
      id: 'urn:sws:evidence:hash:' + receipt.proof.receipt_hash,
      type: ['Evidence'],
      narrative: 'SHA-256 of the SWS attention receipt payload. Tamper-evident.',
      receiptHash: receipt.proof.receipt_hash,
      genre: 'integrity_hash'
    });
  }
  if (receipt.ots && receipt.ots.status) {
    evidence.push({
      id: 'urn:sws:evidence:ots:' + (receipt.ots.bitcoin_block_height || 'pending'),
      type: ['Evidence'],
      narrative: 'OpenTimestamps Bitcoin anchor. Status: ' + receipt.ots.status +
                 (receipt.ots.bitcoin_block_height ? ' (block #' + receipt.ots.bitcoin_block_height + ')' : ''),
      status: receipt.ots.status,
      bitcoinBlockHeight: receipt.ots.bitcoin_block_height || null,
      genre: 'timestamp_anchor'
    });
  }
  if (evidence.length) cred.evidence = evidence;

  return cred;
}

/**
 * Sign an OB 3.0 credential as an EdDSA VC-JWT.
 * Delegates to attention-signer (same signing infrastructure as
 * attention receipts — one kid, one JWKS, one verification story).
 *
 * @param {Object} obCred - from fromReceipt()
 * @param {Object} signer - from attention-signer.createSigner()
 * @returns {Promise<string>} compact EdDSA JWT: header.payload.signature
 */
function toSignedJwt(obCred, signer) {
  if (!signer || typeof signer.sign !== 'function') {
    return Promise.reject(new Error('missing_signer'));
  }
  const payload = {
    iss: obCred.issuer.id,
    sub: obCred.credentialSubject.id,
    iat: Math.floor(new Date(obCred.issuanceDate || obCred.validFrom).getTime() / 1000),
    vc: obCred
  };
  if (typeof require === 'function') {
    const signerMod = require('./attention-signer');
    return signerMod.signJwt(payload, signer);
  }
  return Promise.reject(new Error('signed_jwt_requires_node'));
}

// ============================================================
// STRUCTURAL VALIDATION
// ============================================================

/**
 * Structural check against the OB 3.0 + VC 2.0 conformance profile.
 * Not a full JSON-LD validation — verifies the things that matter
 * for "will this be accepted by Credly / Accredible / a VC wallet."
 */
function validate(cred) {
  const errors = [];
  if (!cred || typeof cred !== 'object') return { valid: false, errors: ['not_an_object'] };

  const ctx = cred['@context'];
  if (!Array.isArray(ctx) || ctx.indexOf(VC_CONTEXT) < 0) errors.push('missing_vc_context');
  if (!Array.isArray(ctx) || ctx.indexOf(OB3_CONTEXT) < 0) errors.push('missing_ob3_context');

  const type = cred.type;
  if (!Array.isArray(type) || type.indexOf('VerifiableCredential') < 0) errors.push('missing_vc_type');
  if (!Array.isArray(type) || type.indexOf('OpenBadgeCredential') < 0) errors.push('missing_ob_type');

  if (!cred.issuer || !cred.issuer.id) errors.push('missing_issuer_id');
  if (!cred.credentialSubject) errors.push('missing_credential_subject');
  else {
    if (!cred.credentialSubject.id) errors.push('missing_subject_id');
    const ach = cred.credentialSubject.achievement;
    if (!ach) errors.push('missing_achievement');
    else {
      if (!ach.id) errors.push('missing_achievement_id');
      if (!ach.name) errors.push('missing_achievement_name');
      if (!ach.criteria) errors.push('missing_achievement_criteria');
    }
  }
  if (!cred.validFrom && !cred.issuanceDate) errors.push('missing_validFrom_or_issuanceDate');

  return { valid: errors.length === 0, errors: errors };
}

// ============================================================
// HELPERS
// ============================================================

function _deriveSubjectDid(userId) {
  if (!userId || userId === 'anonymous') {
    return 'did:sws:anonymous:' + Date.now().toString(36);
  }
  if (typeof userId === 'string' && userId.indexOf('did:') === 0) {
    return userId;
  }
  // Privacy: if the caller accidentally passes something email-like,
  // don't include it in the DID. We fall back to a deterministic hash.
  let normalized = userId;
  if (normalized.indexOf('@') !== -1) normalized = 'redacted_email_' + _shortHash(userId);
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h) + normalized.charCodeAt(i);
    h |= 0;
  }
  return 'did:sws:user:' + Math.abs(h).toString(36);
}

function _shortHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createAchievement: createAchievement,
  fromReceipt: fromReceipt,
  toSignedJwt: toSignedJwt,
  validate: validate,
  VC_CONTEXT: VC_CONTEXT,
  OB3_CONTEXT: OB3_CONTEXT,
  ISSUER_DID: ISSUER_DID,
  ISSUER_NAME: ISSUER_NAME,
  ISSUER_URL: ISSUER_URL
};
