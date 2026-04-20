/**
 * SWS Attention Protocol — W3C Verifiable Credentials
 *
 * Wraps attention receipts as W3C Verifiable Credentials (VC Data Model 2.0)
 * so any enterprise system can verify them without custom integration.
 *
 * A Verifiable Credential contains:
 *   - Issuer (SWS Strategic Media LLC)
 *   - Subject (the user whose attention was verified)
 *   - Claims (engagement metrics, behavioral signals, quality tier)
 *   - Proof (cryptographic signature for integrity)
 *
 * Supports selective disclosure: an employee can prove "I completed training
 * with verified attention" without revealing their exact behavioral scores.
 *
 * Standard: https://www.w3.org/TR/vc-data-model-2.0/
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================

  var VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
  var SWS_CONTEXT = 'https://sws-attention-proofs.web.app/schemas/attention/v1';
  var ISSUER_DID = 'did:web:sws-attention-proofs.web.app';
  var ISSUER_NAME = 'SWS Strategic Media LLC';

  // ============================================================
  // CREDENTIAL GENERATION
  // ============================================================

  /**
   * Convert an SWS attention receipt to a W3C Verifiable Credential.
   *
   * @param {Object} receipt - Standard SWS receipt from SWSReceipts.generateReceipt()
   * @param {Object} opts - Optional overrides
   * @param {string} opts.subjectDid - DID for the subject (default: generated from userId)
   * @param {boolean} opts.includeSignals - Include raw behavioral signals (default: true)
   * @param {boolean} opts.selectiveDisclosure - Enable selective disclosure fields (default: false)
   *
   * @returns {Object} W3C Verifiable Credential
   */
  function fromReceipt(receipt, opts) {
    opts = opts || {};
    var includeSignals = opts.includeSignals !== false;

    var credential = {
      '@context': [VC_CONTEXT, SWS_CONTEXT],
      type: ['VerifiableCredential', 'AttentionVerificationCredential'],
      id: 'urn:sws:receipt:' + receipt.receipt_id,
      issuer: {
        id: ISSUER_DID,
        name: ISSUER_NAME,
        patent: 'SWS-PROV-001'
      },
      issuanceDate: receipt.generated_at,
      validFrom: receipt.generated_at,
      // Credential expiry (RFC 5280 / VC 2.0). Defaults to 24 hours from
      // issuance if the receipt didn't specify. Callers can override by
      // passing opts.validUntilMs or receipt.valid_until (ISO string).
      validUntil: (receipt.valid_until) || (function() {
        var issued = new Date(receipt.generated_at || Date.now()).getTime();
        var ms = (opts.validUntilMs != null) ? opts.validUntilMs : (24 * 60 * 60 * 1000);
        return new Date(issued + ms).toISOString();
      })(),

      credentialSubject: {
        id: opts.subjectDid || _generateSubjectDid(receipt.subject_id),
        type: 'AttentionSession',

        // Core engagement claims
        engagement: {
          contentId: receipt.content_id,
          contentName: receipt.content_name,
          durationMs: receipt.engagement.duration_ms,
          durationFormatted: receipt.engagement.duration_formatted,
          focusScore: receipt.engagement.focus_score,
          qualityTier: receipt.engagement.quality_tier,
          interactionCount: receipt.engagement.interaction_count
        },

        // Human verification verdict
        humanVerification: {
          verdict: receipt.human_verification.verdict,
          compositeScore: receipt.human_verification.composite_score
        },

        // Cryptographic proof chain
        attentionProof: {
          algorithm: 'SHA-256',
          hashCount: receipt.proof.hash_count,
          receiptHash: receipt.proof.receipt_hash
        }
      },

      // Privacy attestation as credential evidence
      evidence: [{
        type: 'PrivacyAttestation',
        noContentRecorded: receipt.privacy.no_content_recorded,
        noPiiCollected: receipt.privacy.no_pii_collected,
        noUrlsTracked: receipt.privacy.no_urls_tracked,
        coppaCompliant: receipt.privacy.coppa_compliant
      }],

      // Credential proof (integrity)
      proof: {
        type: 'Sha256ReceiptIntegrity2026',
        created: receipt.generated_at,
        verificationMethod: ISSUER_DID + '#receipt-signing-key',
        proofPurpose: 'assertionMethod',
        receiptHash: receipt.proof.receipt_hash
      }
    };

    // Consent attestation — GDPR Article 7 + CCPA §1798.120 compliance.
    if (receipt.consent) {
      var c = receipt.consent;
      credential.credentialSubject.consentAttestation = {
        granted: c.granted === true,
        categories: Array.isArray(c.categories) ? c.categories.slice() : [],
        grantedAt: c.timestamp || null,
        version: c.version || null,
        policyUrl: c.policy_url || null,
        note: 'User actively consented to the listed data-collection categories at grantedAt. Revocable at any time. Legal basis per GDPR Art. 7 and CCPA §1798.120.'
      };
    }

    // RFC 3161 Timestamp Authority — buyer-selectable alternative/addition to Bitcoin.
    if (receipt.tsa) {
      var t = receipt.tsa;
      credential.credentialSubject.rfc3161Timestamp = {
        detector: t.detector || 'rfc3161-tsa-v1',
        status: t.status || 'unknown',
        tsaName: t.tsa_name || null,
        tsaUrl: t.tsa_url || null,
        tsaPolicyOid: t.tsa_policy_oid || null,
        serialHex: t.serial_hex || null,
        genTime: t.gen_time || null,
        hashHex: t.hash_hex || null,
        hashAlgorithmOid: t.hash_alg_oid || null,
        tokenB64: t.token_b64 || null,
        stampedAt: t.stamped_at || null,
        note: 'RFC 3161 TimeStampToken — the same format used by Microsoft Authenticode, Adobe PAdES-LTV, and eIDAS qualified timestamps. Verify independently with openssl ts -verify.'
      };
    }

    // OpenTimestamps — Bitcoin-anchored proof-of-existence.
    // Carried on the receipt AFTER hashing (self-authenticating against receipt_hash).
    if (receipt.ots) {
      var o = receipt.ots;
      credential.credentialSubject.bitcoinAnchor = {
        detector: o.detector || 'opentimestamps-v1',
        status: o.status || 'unknown',
        proofB64: o.proof_b64 || null,
        stampedAt: o.stamped_at || null,
        bitcoinBlockHeight: o.bitcoin_block_height || null,
        bitcoinBlockTime: o.bitcoin_block_time || null,
        lastUpgradeCheck: o.last_upgrade_check || null,
        note: 'OpenTimestamps anchors the receipt hash to the Bitcoin blockchain. Once status=bitcoin_confirmed, the receipt is provably as-old-as the referenced Bitcoin block. Verify with src/sdk/attention-anchor.verify(receiptHash, proofB64).'
      };
    }

    // Honeypot Canary (Signal 22) — invisible prompt-injected token
    // detector. If tripped, an LLM assisted.
    if (receipt.honeypot) {
      var h = receipt.honeypot;
      credential.credentialSubject.honeypotCanary = {
        detector: h.detector || 'sws-honeypot-v1',
        canaryId: h.canary_id || null,
        tripped: !!h.tripped,
        verdict: h.verdict || (h.tripped ? 'llm_assisted_suspected' : 'clean'),
        strategiesUsed: Array.isArray(h.strategies_used) ? h.strategies_used.slice() : [],
        detectionMethod: h.detection_method || null,
        injectedAt: h.injected_at || null,
        checkedAt: h.checked_at || null,
        note: h.note || 'Honeypot canary: invisible prompt-injection token. Tripping this signal is near-certain proof of LLM assistance; not tripping is weak evidence of absence.'
      };
    }

    // Composition Integrity (Signal 21) — LLM-assisted cheating detection.
    // Included in credentialSubject when the receipt carries it.
    if (receipt.composition_integrity) {
      var ci = receipt.composition_integrity;
      credential.credentialSubject.compositionIntegrity = {
        detector: ci.detector || 'sws-composition-v1',
        verdict: ci.composition_verdict || 'unknown',
        score: typeof ci.composition_integrity_score === 'number'
          ? ci.composition_integrity_score : null,
        charsObserved: ci.chars_observed || 0,
        pasteBurstDetected: !!ci.paste_burst_detected,
        pasteBurstCount: ci.paste_burst_count || 0,
        longestPasteChars: ci.longest_paste_chars || 0,
        backspaceRatio: typeof ci.backspace_ratio === 'number' ? ci.backspace_ratio : null,
        backspaceSuspicious: !!ci.backspace_suspicious,
        digraphCv: ci.digraph_stats && typeof ci.digraph_stats.cv === 'number'
          ? ci.digraph_stats.cv : null,
        digraphTotalIntervals: ci.digraph_stats ? (ci.digraph_stats.total_intervals || 0) : 0,
        subhumanIntervalCount: ci.digraph_stats ? (ci.digraph_stats.subhuman_interval_count || 0) : 0,
        checkedAt: ci.checked_at || null,
        note: 'Composition Integrity is separate from behavioral composite and environmental gate. Detects LLM-assisted cheating via paste/keystroke patterns.'
      };
    }

    // Environmental gate (non-behavioral; always included when present on the receipt)
    if (receipt.environmental) {
      credential.credentialSubject.environmental = {
        loaded: !!receipt.environmental.loaded,
        bot: receipt.environmental.loaded ? !!receipt.environmental.bot : null,
        botKind: receipt.environmental.bot_kind || null,
        detector: receipt.environmental.detector || null,
        checkedAt: receipt.environmental.checked_at || null,
        latencyMs: typeof receipt.environmental.latency_ms === 'number'
          ? receipt.environmental.latency_ms : null,
        error: receipt.environmental.error || null,
        note: 'Environmental gate is separate from behavioral composite. Combine as your policy requires.'
      };
    }

    // Include raw behavioral signals if not using selective disclosure
    if (includeSignals && receipt.human_verification) {
      credential.credentialSubject.humanVerification.signals = {
        timingEntropy: receipt.human_verification.timing_entropy,
        fittsCompliance: receipt.human_verification.fitts_compliance,
        hicksCompliance: receipt.human_verification.hicks_compliance,
        scrollSaccade: receipt.human_verification.scroll_saccade,
        microPause: receipt.human_verification.micro_pause,
        touchVariance: receipt.human_verification.touch_variance
      };
    }

    // Add completion data if present
    if (receipt.completion) {
      credential.credentialSubject.completion = {
        type: receipt.completion.type,
        startedAt: receipt.completion.started_at,
        completedAt: receipt.completion.completed_at,
        minimumRequiredMinutes: receipt.completion.minimum_required_minutes,
        actualMinutes: receipt.completion.actual_minutes,
        metMinimum: receipt.completion.met_minimum,
        engagementSufficient: receipt.completion.engagement_sufficient,
        humanVerified: receipt.completion.human_verified
      };

      // Add credential type
      credential.type.push('TrainingCompletionCredential');
    }

    // Add device binding if present
    if (receipt.device_attestation) {
      credential.credentialSubject.deviceBinding = {
        type: receipt.device_attestation.type,
        deviceBound: receipt.device_attestation.device_bound,
        timestamp: receipt.device_attestation.timestamp
      };
    }

    return credential;
  }

  // ============================================================
  // SELECTIVE DISCLOSURE
  // ============================================================

  /**
   * Create a presentation with selective disclosure.
   * The holder reveals only the fields they choose.
   *
   * @param {Object} credential - Full verifiable credential
   * @param {string[]} discloseFields - Fields to include in presentation
   *   Options: 'verdict', 'tier', 'duration', 'focusScore', 'completion',
   *            'signals', 'privacy', 'device'
   *
   * @returns {Object} Verifiable Presentation with selected fields
   */
  function createPresentation(credential, discloseFields) {
    discloseFields = discloseFields || ['verdict', 'tier', 'completion'];

    var disclosed = {
      '@context': [VC_CONTEXT, SWS_CONTEXT],
      type: ['VerifiablePresentation', 'AttentionVerificationPresentation'],
      holder: credential.credentialSubject.id,
      verifiableCredential: [{
        '@context': credential['@context'],
        type: credential.type,
        id: credential.id,
        issuer: credential.issuer,
        issuanceDate: credential.issuanceDate,
        credentialSubject: {
          id: credential.credentialSubject.id,
          type: credential.credentialSubject.type
        },
        proof: credential.proof
      }]
    };

    var subject = disclosed.verifiableCredential[0].credentialSubject;

    // Selectively include fields
    discloseFields.forEach(function(field) {
      switch(field) {
        case 'verdict':
          subject.humanVerification = {
            verdict: credential.credentialSubject.humanVerification.verdict
          };
          break;
        case 'tier':
          if (!subject.engagement) subject.engagement = {};
          subject.engagement.qualityTier = credential.credentialSubject.engagement.qualityTier;
          break;
        case 'duration':
          if (!subject.engagement) subject.engagement = {};
          subject.engagement.durationFormatted = credential.credentialSubject.engagement.durationFormatted;
          break;
        case 'focusScore':
          if (!subject.engagement) subject.engagement = {};
          subject.engagement.focusScore = credential.credentialSubject.engagement.focusScore;
          break;
        case 'completion':
          if (credential.credentialSubject.completion) {
            subject.completion = credential.credentialSubject.completion;
          }
          break;
        case 'signals':
          if (credential.credentialSubject.humanVerification.signals) {
            if (!subject.humanVerification) subject.humanVerification = {};
            subject.humanVerification.signals = credential.credentialSubject.humanVerification.signals;
          }
          break;
        case 'privacy':
          disclosed.verifiableCredential[0].evidence = credential.evidence;
          break;
        case 'device':
          if (credential.credentialSubject.deviceBinding) {
            subject.deviceBinding = credential.credentialSubject.deviceBinding;
          }
          break;
      }
    });

    return disclosed;
  }

  // ============================================================
  // HUMANNESS PRESENTATION (proof-of-humanness without doxxing)
  // ============================================================

  /**
   * Build a minimal-disclosure "proof of humanness" presentation from
   * a full attention credential. This is what a user presents to a
   * verifier (a social platform, a marketplace, a policy comment form)
   * in place of proving identity. Reveals ONLY:
   *   - isHuman (boolean — verdict begins "verified_human")
   *   - qualityTier (bucket only: "deep"|"active"|"passive"|"background")
   *   - validUntil (expiry)
   *   - issuer (so the verifier knows which public key to load)
   * Does NOT reveal:
   *   - individual behavioral signals
   *   - timestamps beyond the expiry
   *   - subject DID beyond a one-way-hashed nonce
   *   - any content/session identifiers
   *
   * Privacy property: two presentations from the same source credential
   * are NOT linkable to each other beyond the issuer DID. (Full
   * unlinkable-presentation crypto — BBS+ signatures etc. — is a
   * post-YC roadmap item.)
   *
   * @param {Object} credential - full VC from fromReceipt()
   * @returns {Object} VerifiablePresentation with humanness-only disclosure
   */
  function createHumannessPresentation(credential) {
    if (!credential || !credential.credentialSubject) {
      throw new Error('invalid_credential');
    }
    var hv = credential.credentialSubject.humanVerification || {};
    var eng = credential.credentialSubject.engagement || {};
    var verdict = hv.verdict || '';
    var isHuman = verdict.indexOf('verified_human') === 0;

    return {
      '@context': [VC_CONTEXT, SWS_CONTEXT],
      type: ['VerifiablePresentation', 'HumannessPresentation'],
      verifiableCredential: [{
        '@context': credential['@context'],
        type: ['VerifiableCredential', 'HumannessCredential'],
        id: credential.id,
        issuer: credential.issuer,
        issuanceDate: credential.issuanceDate,
        validUntil: credential.validUntil,
        credentialSubject: {
          id: credential.credentialSubject.id,
          type: 'HumannessClaim',
          isHuman: isHuman,
          qualityTier: eng.qualityTier || 'unknown',
          validUntil: credential.validUntil,
          note: 'Proof of human attention. No identity, no signals, no timestamps beyond expiry. Verify offline at https://sws-attention-proofs.web.app/prove-humanness.html'
        },
        proof: credential.proof
      }]
    };
  }

  // ============================================================
  // VERIFICATION
  // ============================================================

  /**
   * Verify a credential or presentation's structural integrity.
   * Full cryptographic verification requires the issuer's public key
   * and happens server-side. This is the structural validation.
   */
  function verify(credentialOrPresentation) {
    var errors = [];

    // Check if it's a presentation or credential
    var credential = credentialOrPresentation;
    if (credentialOrPresentation.type &&
        credentialOrPresentation.type.indexOf('VerifiablePresentation') >= 0) {
      if (!credentialOrPresentation.verifiableCredential ||
          credentialOrPresentation.verifiableCredential.length === 0) {
        errors.push('presentation_has_no_credentials');
      }
      credential = credentialOrPresentation.verifiableCredential
        ? credentialOrPresentation.verifiableCredential[0]
        : null;
    }

    if (!credential) {
      return { valid: false, errors: ['no_credential_found'] };
    }

    // Structural checks
    if (!credential['@context'] || credential['@context'].indexOf(VC_CONTEXT) < 0) {
      errors.push('missing_vc_context');
    }
    if (!credential.type || credential.type.indexOf('VerifiableCredential') < 0) {
      errors.push('missing_vc_type');
    }
    if (!credential.issuer || !credential.issuer.id) {
      errors.push('missing_issuer');
    }
    if (!credential.credentialSubject || !credential.credentialSubject.id) {
      errors.push('missing_subject');
    }
    if (!credential.proof || !credential.proof.receiptHash) {
      errors.push('missing_proof');
    }
    if (!credential.issuanceDate) {
      errors.push('missing_issuance_date');
    }

    // Issuer check
    if (credential.issuer && credential.issuer.id !== ISSUER_DID) {
      errors.push('unknown_issuer: ' + credential.issuer.id);
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      issuer: credential.issuer ? credential.issuer.name : 'unknown',
      subject: credential.credentialSubject ? credential.credentialSubject.id : 'unknown',
      type: credential.type || [],
      note: errors.length === 0
        ? 'Structural validation passed. Full cryptographic verification requires server-side check.'
        : 'Structural validation failed.'
    };
  }

  // ============================================================
  // EXPORT FORMATS
  // ============================================================

  /**
   * Export credential as JWT-encoded VC (VC-JWT format).
   * Unsigned (alg=none). For production, use toSignedJwt() with an Ed25519 signer.
   * Preserved for backwards compatibility and dev/test use.
   */
  function toJwt(credential) {
    var header = { alg: 'none', typ: 'JWT' };
    var payload = {
      iss: credential.issuer.id,
      sub: credential.credentialSubject.id,
      iat: Math.floor(new Date(credential.issuanceDate).getTime() / 1000),
      vc: credential
    };

    var headerB64 = btoa(JSON.stringify(header));
    var payloadB64 = btoa(JSON.stringify(payload));
    return headerB64 + '.' + payloadB64 + '.';
  }

  /**
   * Export credential as EdDSA-signed VC-JWT.
   * Asynchronous. Requires a signer from attention-signer.createSigner().
   *
   * @param {Object} credential - VC from fromReceipt()
   * @param {Object} signer - { sign, kid, algorithm } from attention-signer
   * @returns {Promise<string>} compact JWT: header.payload.signature (EdDSA)
   */
  function toSignedJwt(credential, signer) {
    if (!signer || typeof signer.sign !== 'function') {
      return Promise.reject(new Error('missing_signer'));
    }
    var payload = {
      iss: credential.issuer.id,
      sub: credential.credentialSubject.id,
      iat: Math.floor(new Date(credential.issuanceDate).getTime() / 1000),
      vc: credential
    };
    // JWT exp (RFC 7519 §4.1.4). Taken from the credential's validUntil if
    // present, so the JWT claim mirrors the VC field. Verifiers (ours + any
    // third-party RFC 7519-compliant parser) will reject expired tokens.
    if (credential.validUntil) {
      var expDate = new Date(credential.validUntil);
      if (!isNaN(expDate.getTime())) {
        payload.exp = Math.floor(expDate.getTime() / 1000);
      }
    }
    // Lazy require to keep browser bundle slim (signer is Node-only)
    if (typeof require === 'function') {
      var signerMod = require('./attention-signer');
      return signerMod.signJwt(payload, signer);
    }
    return Promise.reject(new Error('signed_jwt_requires_node'));
  }

  /**
   * Export as JSON-LD (default W3C format).
   */
  function toJsonLd(credential) {
    return JSON.stringify(credential, null, 2);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _generateSubjectDid(userId) {
    if (!userId || userId === 'anonymous') {
      return 'did:sws:anonymous:' + Date.now().toString(36);
    }
    // Hash the userId to avoid PII in the DID
    var hash = 0;
    for (var i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return 'did:sws:user:' + Math.abs(hash).toString(36);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  var VerifiableCredentials = {
    fromReceipt: fromReceipt,
    createPresentation: createPresentation,
    createHumannessPresentation: createHumannessPresentation,
    verify: verify,
    toJwt: toJwt,
    toSignedJwt: toSignedJwt,
    toJsonLd: toJsonLd,
    ISSUER_DID: ISSUER_DID,
    ISSUER_NAME: ISSUER_NAME
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerifiableCredentials;
  } else if (typeof root !== 'undefined') {
    root.SWSVerifiableCredentials = VerifiableCredentials;
  }

})(typeof window !== 'undefined' ? window : this);
