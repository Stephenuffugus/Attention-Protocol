/**
 * SWS Attention Protocol — xAPI (Experience API) Adapter
 *
 * Converts an SWS receipt (or signed VC-JWT) into an xAPI 1.0.3 Statement
 * that any Learning Record Store (LRS) can ingest. Target integrations:
 * Moodle, Canvas/Instructure, Articulate Storyline, D2L Brightspace,
 * SAP SuccessFactors, Cornerstone, Degreed — all of which natively
 * consume xAPI statements.
 *
 * The full signed JWT is embedded as a standards-compliant extension,
 * so the LRS can store the cryptographic receipt alongside the statement
 * and any downstream system can re-verify it later.
 *
 * Standards:
 *   - xAPI 1.0.3 (ADL, IEEE 9274.1.1) — https://github.com/adlnet/xAPI-Spec
 *   - ADL verb vocabulary — http://adlnet.gov/expapi/verbs/
 *   - CMI5 profile for structured learning — Advanced Distributed Learning
 *
 * Privacy (unchanged from the wider protocol):
 *   - Actor uses a pseudonymous SWS DID, never an email or name.
 *   - Result `extensions` carry only the attestation layers we already
 *     ship in the receipt — no session content, no URLs, no keystrokes.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

// ============================================================
// CONSTANTS (stable URIs — changing these breaks downstream LRS queries)
// ============================================================

var ISSUER_HOMEPAGE = 'https://sws-attention-proofs.web.app';
var AUTHORITY_NAME = 'SWS Strategic Media LLC';
var AUTHORITY_DID = 'did:web:sws-attention-proofs.web.app';

// ADL standard verbs — do not invent your own if a standard one exists.
var VERB_COMPLETED = {
  id: 'http://adlnet.gov/expapi/verbs/completed',
  display: { 'en-US': 'completed' }
};
var VERB_EXPERIENCED = {
  id: 'http://adlnet.gov/expapi/verbs/experienced',
  display: { 'en-US': 'experienced' }
};
var VERB_ATTENDED = {
  id: 'http://adlnet.gov/expapi/verbs/attended',
  display: { 'en-US': 'attended' }
};

// SWS extension namespaces. Stable — change means data migration.
var EXT_SIGNED_JWT      = 'https://sws-attention-proofs.web.app/xapi/ext/signed-receipt';
var EXT_ATTESTATION     = 'https://sws-attention-proofs.web.app/xapi/ext/attestation-layers';
var EXT_RECEIPT_HASH    = 'https://sws-attention-proofs.web.app/xapi/ext/receipt-hash';
var EXT_PUBLIC_KEY_URL  = 'https://sws-attention-proofs.web.app/xapi/ext/public-key-url';
var PUBLIC_KEY_URL      = 'https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json';

// Activity types — https://adlnet.gov/expapi/activities/
var ACTIVITY_MODULE   = 'http://adlnet.gov/expapi/activities/module';
var ACTIVITY_COURSE   = 'http://adlnet.gov/expapi/activities/course';
var ACTIVITY_LESSON   = 'http://adlnet.gov/expapi/activities/lesson';

// ============================================================
// CORE ADAPTER
// ============================================================

/**
 * Build an xAPI 1.0.3 Statement from an SWS receipt.
 *
 * @param {Object} receipt - a receipt from SWSReceipts.generateReceipt
 * @param {Object} [opts]
 * @param {string} [opts.activityIri] - fully-qualified IRI for the activity.
 *                  Defaults to a derived IRI under the issuer homepage.
 * @param {string} [opts.activityType=ACTIVITY_MODULE]
 * @param {Object} [opts.verb] - override the default verb (completed / attended)
 * @param {string} [opts.signedJwt] - if provided, embedded as an xAPI extension
 * @param {string} [opts.actorName] - fallback display name; NO email/phone
 * @returns {Object} xAPI 1.0.3 Statement
 */
function fromReceipt(receipt, opts) {
  opts = opts || {};
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('xapi_adapter_missing_receipt');
  }

  var verb = opts.verb || _inferVerb(receipt);
  var activityIri = opts.activityIri || _deriveActivityIri(receipt);
  var activityType = opts.activityType || ACTIVITY_MODULE;
  var contentName = (receipt.content_name || receipt.content_id || 'SWS Attention Activity').toString();

  var result = _buildResult(receipt);
  var extensions = _buildExtensions(receipt, opts.signedJwt);

  if (Object.keys(extensions).length > 0) {
    result.extensions = extensions;
  }

  var statement = {
    actor: _buildActor(receipt, opts.actorName),
    verb: verb,
    object: {
      objectType: 'Activity',
      id: activityIri,
      definition: {
        name: { 'en-US': contentName },
        type: activityType
      }
    },
    result: result,
    timestamp: receipt.generated_at || new Date().toISOString(),
    authority: {
      objectType: 'Agent',
      account: {
        homePage: ISSUER_HOMEPAGE,
        name: AUTHORITY_NAME
      }
    },
    version: '1.0.3'
  };

  return statement;
}

/**
 * Build an xAPI Statement from a signed VC-JWT WITHOUT verifying the
 * signature. Decodes the JWT and maps the embedded W3C VC credentialSubject
 * to xAPI fields, then embeds the original JWT as an extension.
 *
 * **Security note (2026-05-27 audit):** an attacker who hand-crafts a JWT
 * with `alg:none` (or an arbitrary signature) can produce a syntactically
 * valid xAPI Statement here. The Statement's `actor.account.name` and
 * `result.score` will reflect attacker-controlled claims unless the LRS
 * (or some other downstream consumer) re-verifies the embedded JWT.
 *
 * **Use `fromVerifiedJwt` instead** for any production ingestion path.
 * This function is retained for cases where verification is unambiguously
 * performed elsewhere in the pipeline (e.g., a gateway that has already
 * validated the JWT before this adapter is invoked).
 *
 * @param {string} jwt - compact JWT (header.payload.signature)
 * @param {Object} [opts] - same shape as fromReceipt, but signedJwt is auto-set
 * @returns {Object} xAPI 1.0.3 Statement
 */
function fromSignedJwt(jwt, opts) {
  opts = opts || {};
  if (typeof jwt !== 'string' || jwt.split('.').length !== 3) {
    throw new Error('xapi_adapter_invalid_jwt');
  }
  var parts = jwt.split('.');
  var payload;
  try {
    payload = JSON.parse(_b64urlDecode(parts[1]));
  } catch (e) {
    throw new Error('xapi_adapter_payload_not_json');
  }
  if (!payload || !payload.vc) {
    throw new Error('xapi_adapter_missing_vc_claim');
  }
  var receipt = _credentialToReceiptLike(payload.vc, payload);
  var merged = {};
  for (var k in opts) if (opts.hasOwnProperty(k)) merged[k] = opts[k];
  merged.signedJwt = jwt;
  return fromReceipt(receipt, merged);
}

/**
 * Build an xAPI Statement from a signed VC-JWT, verifying the signature
 * against the supplied JWKS first. RECOMMENDED entry point for any
 * production LRS ingestion — refuses to map a JWT whose signature cannot
 * be verified.
 *
 * Added 2026-05-27 in response to a hostile crypto audit (Class 14):
 * `fromSignedJwt` previously did no verification and could be fed an
 * unsigned JWT to produce a syntactically valid Statement.
 *
 * @param {string} jwt - compact JWT (header.payload.signature)
 * @param {Object|Array} jwks - a JWK, an array of JWKs, or a JWKS-style
 *        `{keys:[...]}` object. The right key is selected by `header.kid`.
 * @param {Object} [opts] - same shape as fromReceipt; signedJwt auto-set
 * @returns {Promise<Object>} xAPI 1.0.3 Statement
 * @throws if header is malformed, kid is missing, kid is not in jwks,
 *         or signature verification fails.
 */
async function fromVerifiedJwt(jwt, jwks, opts) {
  if (typeof jwt !== 'string' || jwt.split('.').length !== 3) {
    throw new Error('xapi_adapter_invalid_jwt');
  }
  if (!jwks) {
    throw new Error('xapi_adapter_missing_jwks');
  }
  var parts = jwt.split('.');
  var header;
  try {
    header = JSON.parse(_b64urlDecode(parts[0]));
  } catch (e) {
    throw new Error('xapi_adapter_header_not_json');
  }
  if (!header.kid) {
    throw new Error('xapi_adapter_jwt_missing_kid');
  }
  var jwk = _selectJwk(jwks, header.kid);
  if (!jwk) {
    throw new Error('xapi_adapter_kid_not_in_jwks:' + header.kid);
  }
  if (typeof require !== 'function') {
    throw new Error('xapi_adapter_verify_requires_node');
  }
  var signer = require('./attention-signer');
  var result = await signer.verifyJwt(jwt, jwk);
  if (!result.valid) {
    throw new Error('xapi_adapter_jwt_invalid:' + (result.error || 'unknown'));
  }
  // Signature verified — safe to map. Delegates to fromSignedJwt now that
  // the JWT's authenticity is established.
  return fromSignedJwt(jwt, opts);
}

/**
 * Locate the JWK matching `kid` inside a flexible JWKS-shaped input.
 * Accepts a single JWK, an array of JWKs, or a {keys:[...]} envelope.
 *
 * @param {Object|Array} jwks
 * @param {string} kid
 * @returns {Object|null}
 */
function _selectJwk(jwks, kid) {
  if (!jwks || !kid) return null;
  if (Array.isArray(jwks)) {
    for (var i = 0; i < jwks.length; i++) {
      if (jwks[i] && jwks[i].kid === kid) return jwks[i];
    }
    return null;
  }
  if (jwks.keys && Array.isArray(jwks.keys)) {
    for (var j = 0; j < jwks.keys.length; j++) {
      if (jwks.keys[j] && jwks.keys[j].kid === kid) return jwks.keys[j];
    }
    return null;
  }
  if (jwks.kid === kid) return jwks;
  return null;
}

// ============================================================
// SUBCOMPONENT BUILDERS
// ============================================================

function _buildActor(receipt, fallbackName) {
  var subjectId = receipt.subject_id || 'anonymous';
  // Never emit anything that could be an email.
  if (subjectId.indexOf('@') !== -1) subjectId = 'redacted_email';
  return {
    objectType: 'Agent',
    account: {
      homePage: ISSUER_HOMEPAGE,
      name: subjectId.indexOf('did:') === 0 ? subjectId : ('did:sws:user:' + _shortHash(subjectId))
    },
    name: fallbackName || undefined
  };
}

function _buildResult(receipt) {
  var result = {};
  var hv = receipt.human_verification || {};
  var eng = receipt.engagement || {};

  if (typeof eng.duration_ms === 'number' && eng.duration_ms > 0) {
    result.duration = _isoDuration(eng.duration_ms);
  }
  if (typeof hv.composite_score === 'number') {
    result.score = { scaled: Math.max(0, Math.min(1, hv.composite_score)) };
  }
  if (receipt.completion) {
    if (typeof receipt.completion.met_minimum === 'boolean') {
      result.completion = receipt.completion.met_minimum;
    }
    if (typeof receipt.completion.engagement_sufficient === 'boolean') {
      result.success = receipt.completion.engagement_sufficient;
    }
  } else if (hv.verdict) {
    result.completion = true;
    result.success = (hv.verdict.indexOf('verified_human') === 0);
  }
  return result;
}

function _buildExtensions(receipt, signedJwt) {
  var ext = {};
  if (signedJwt) ext[EXT_SIGNED_JWT] = signedJwt;
  if (receipt.proof && receipt.proof.receipt_hash) {
    ext[EXT_RECEIPT_HASH] = receipt.proof.receipt_hash;
  }
  ext[EXT_PUBLIC_KEY_URL] = PUBLIC_KEY_URL;

  var layers = {};
  if (receipt.environmental)          layers.environmental = receipt.environmental;
  if (receipt.composition_integrity)  layers.composition_integrity = receipt.composition_integrity;
  if (receipt.consent)                layers.consent = receipt.consent;
  if (receipt.ots)                    layers.bitcoin_anchor = receipt.ots;
  if (receipt.human_verification)     layers.behavioral = receipt.human_verification;
  if (Object.keys(layers).length > 0) ext[EXT_ATTESTATION] = layers;

  return ext;
}

function _inferVerb(receipt) {
  if (receipt.completion && receipt.completion.met_minimum) return VERB_COMPLETED;
  var hv = receipt.human_verification || {};
  if (hv.verdict && hv.verdict.indexOf('verified_human') === 0) return VERB_ATTENDED;
  return VERB_EXPERIENCED;
}

function _deriveActivityIri(receipt) {
  var cid = receipt.content_id || receipt.receipt_id || ('anonymous_' + Date.now());
  // URL-safe but recognisable
  var safe = cid.replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 80);
  return ISSUER_HOMEPAGE + '/xapi/activities/' + safe;
}

// ============================================================
// STATEMENT → RECEIPT SHAPE (for fromSignedJwt)
// ============================================================

function _credentialToReceiptLike(vc, payload) {
  var subj = vc.credentialSubject || {};
  var eng = subj.engagement || {};
  var hv = subj.humanVerification || {};
  var env = subj.environmental || null;
  var ci = subj.compositionIntegrity || null;
  var consent = subj.consentAttestation || null;
  var ba = subj.bitcoinAnchor || null;

  return {
    receipt_id: vc.id || ('urn:sws:jwt:' + (payload.iat || Date.now())),
    subject_id: subj.id || 'anonymous',
    content_id: eng.contentId || 'unknown',
    content_name: eng.contentName || '',
    generated_at: vc.issuanceDate || new Date().toISOString(),
    engagement: {
      duration_ms: eng.durationMs || 0,
      duration_formatted: eng.durationFormatted || null,
      focus_score: eng.focusScore || null,
      quality_tier: eng.qualityTier || null,
      interaction_count: eng.interactionCount || 0
    },
    human_verification: {
      composite_score: typeof hv.compositeScore === 'number' ? hv.compositeScore : null,
      verdict: hv.verdict || null
    },
    environmental: env ? {
      loaded: env.loaded, bot: env.bot, bot_kind: env.botKind || null,
      detector: env.detector, checked_at: env.checkedAt, latency_ms: env.latencyMs
    } : null,
    composition_integrity: ci ? {
      detector: ci.detector,
      composition_verdict: ci.verdict,
      composition_integrity_score: ci.score,
      chars_observed: ci.charsObserved,
      paste_burst_detected: ci.pasteBurstDetected,
      paste_burst_count: ci.pasteBurstCount,
      checked_at: ci.checkedAt
    } : null,
    consent: consent ? {
      granted: consent.granted, categories: consent.categories,
      timestamp: consent.grantedAt, version: consent.version,
      policy_url: consent.policyUrl
    } : null,
    ots: ba ? {
      detector: ba.detector, status: ba.status,
      proof_b64: ba.proofB64,
      bitcoin_block_height: ba.bitcoinBlockHeight,
      bitcoin_block_time: ba.bitcoinBlockTime,
      stamped_at: ba.stampedAt
    } : null,
    proof: {
      algorithm: 'SHA-256',
      receipt_hash: (vc.proof && vc.proof.receiptHash) ||
                    (subj.attentionProof && subj.attentionProof.receiptHash) || null
    }
  };
}

// ============================================================
// STRUCTURAL VALIDATION
// ============================================================

/**
 * Structural check against the xAPI 1.0.3 Statement requirements.
 * Not a full JSON Schema — verifies the things an LRS will reject on.
 */
function validate(statement) {
  var errors = [];
  if (!statement || typeof statement !== 'object') {
    return { valid: false, errors: ['not_an_object'] };
  }
  if (!statement.actor) errors.push('missing_actor');
  else if (!statement.actor.account || !statement.actor.account.homePage || !statement.actor.account.name) {
    errors.push('actor_account_incomplete');
  }
  if (!statement.verb || !statement.verb.id) errors.push('missing_verb_id');
  if (!statement.object || !statement.object.id) errors.push('missing_object_id');
  if (statement.object && !_isIri(statement.object.id)) errors.push('object_id_not_iri');
  if (statement.verb && !_isIri(statement.verb.id)) errors.push('verb_id_not_iri');
  if (statement.result && statement.result.score && typeof statement.result.score.scaled === 'number') {
    var s = statement.result.score.scaled;
    if (s < 0 || s > 1) errors.push('score_scaled_out_of_range');
  }
  if (!statement.timestamp) errors.push('missing_timestamp');

  return { valid: errors.length === 0, errors: errors };
}

// ============================================================
// HELPERS
// ============================================================

function _isIri(s) {
  return typeof s === 'string' && /^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(s);
}

function _isoDuration(ms) {
  // ISO 8601 duration — P[n]DT[n]H[n]M[n]S. Covers up to days for long sessions.
  var total = Math.max(0, Math.floor(ms / 1000));
  var d = Math.floor(total / 86400);
  var h = Math.floor((total % 86400) / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  var out = 'P';
  if (d) out += d + 'D';
  out += 'T';
  if (h) out += h + 'H';
  if (m) out += m + 'M';
  out += s + 'S';
  return out;
}

function _shortHash(s) {
  // Deterministic short hash without crypto dep — just spread for a pseudo-DID.
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function _b64urlDecode(s) {
  var pad = 4 - (s.length % 4);
  var padded = s + (pad < 4 ? '='.repeat(pad) : '');
  var b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  // Browser fallback
  return atob(b64);
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  fromReceipt: fromReceipt,
  fromSignedJwt: fromSignedJwt,
  fromVerifiedJwt: fromVerifiedJwt,
  validate: validate,
  VERB_COMPLETED: VERB_COMPLETED,
  VERB_EXPERIENCED: VERB_EXPERIENCED,
  VERB_ATTENDED: VERB_ATTENDED,
  ACTIVITY_MODULE: ACTIVITY_MODULE,
  ACTIVITY_COURSE: ACTIVITY_COURSE,
  ACTIVITY_LESSON: ACTIVITY_LESSON,
  EXT_SIGNED_JWT: EXT_SIGNED_JWT,
  EXT_ATTESTATION: EXT_ATTESTATION,
  EXT_RECEIPT_HASH: EXT_RECEIPT_HASH,
  EXT_PUBLIC_KEY_URL: EXT_PUBLIC_KEY_URL,
  PUBLIC_KEY_URL: PUBLIC_KEY_URL
};
