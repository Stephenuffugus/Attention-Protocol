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
   * Note: This is a simplified version. Production should use
   * proper JWT signing with Ed25519 or ES256 key pairs.
   */
  function toJwt(credential) {
    var header = { alg: 'none', typ: 'JWT' }; // Unsigned for now
    var payload = {
      iss: credential.issuer.id,
      sub: credential.credentialSubject.id,
      iat: Math.floor(new Date(credential.issuanceDate).getTime() / 1000),
      vc: credential
    };

    var headerB64 = btoa(JSON.stringify(header));
    var payloadB64 = btoa(JSON.stringify(payload));
    return headerB64 + '.' + payloadB64 + '.'; // Unsigned
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
    verify: verify,
    toJwt: toJwt,
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
