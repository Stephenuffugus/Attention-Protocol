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

    // Receipt-wide gated composite — layers the behavioral composite on
    // top of the independent integrity layers (env / composition / honeypot)
    // so the receipt self-describes the aggregate judgment in one number.
    // The pure behavioral composite is preserved as `compositeScore`; the
    // new `compositeScoreFinal` + `gatesApplied` provide defense-in-depth
    // aggregation with full provenance for auditors.
    try {
      var rcMod = null;
      if (typeof require === 'function') {
        rcMod = require('./receipt-composite');
      } else if (typeof window !== 'undefined' && window.SWSReceiptComposite) {
        rcMod = window.SWSReceiptComposite;
      }
      if (rcMod && typeof rcMod.computeFinalComposite === 'function') {
        var bc = (receipt.human_verification && typeof receipt.human_verification.composite_score === 'number')
          ? receipt.human_verification.composite_score
          : 0;
        var hpInput = receipt.honeypot ? { tripped: !!receipt.honeypot.tripped } : null;
        var ciInput = credential.credentialSubject.compositionIntegrity
          ? { verdict: credential.credentialSubject.compositionIntegrity.verdict,
              score: credential.credentialSubject.compositionIntegrity.score }
          : null;
        var envInput = credential.credentialSubject.environmental
          ? { loaded: credential.credentialSubject.environmental.loaded,
              bot: credential.credentialSubject.environmental.bot,
              botKind: credential.credentialSubject.environmental.botKind }
          : null;
        // Round-7 R4-NEW-2 fix: wire the optional gates-override
        // through. Pre-fix verifiable-credentials.js never passed
        // `gates` to computeFinalComposite, so gatesOverridden was
        // structurally always false in production — round-4 caught
        // it as dead code. Now: if the caller's receipt includes
        // human_verification.gates_override (a verifier-explicit
        // opt-in field, e.g., for a multi-tenant deployment where a
        // customer overrides the gate caps), pass it through. The
        // receipt-composite module only sets gatesOverridden=true
        // when resolved values DIFFER from DEFAULT_GATES; empty
        // {gates:{}} doesn't trigger it. So the verify.html banner
        // is now reachable from any receipt that opts in.
        var gatesOverride = (receipt.human_verification
          && receipt.human_verification.gates_override
          && typeof receipt.human_verification.gates_override === 'object')
          ? receipt.human_verification.gates_override : null;
        var computeArgs = {
          behavioralComposite: bc,
          environmental: envInput,
          compositionIntegrity: ciInput,
          honeypot: hpInput
        };
        if (gatesOverride) computeArgs.gates = gatesOverride;
        var gated = rcMod.computeFinalComposite(computeArgs);
        credential.credentialSubject.humanVerification.compositeScoreFinal = gated.finalComposite;
        credential.credentialSubject.humanVerification.qualityTierFinal = gated.tierFinal;
        credential.credentialSubject.humanVerification.gatesApplied = gated.gatesApplied;
        credential.credentialSubject.humanVerification.compositeGateVersion = gated.version;
        // Round-3 R3-NEW-1: surface gatesOverridden so verifiers can
        // reject decision-grade receipts where the issuer swapped in a
        // more permissive gate table. Mirrors the calibration_override
        // pattern. The receipt-composite SDK only sets this true when
        // resolved gate values actually differ from defaults — empty
        // {gates:{}} doesn't trigger it.
        if (gated.gatesOverridden === true) {
          credential.credentialSubject.humanVerification.gatesOverridden = true;
        }
      }
    } catch (_e) {
      // Fail-silent: gated composite is additive; its absence never breaks
      // a receipt. Existing compositeScore remains the canonical legacy field.
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

  // Round-2 R2-NEW-13 fix: previous implementation was a 32-bit
  // Java-style multiplicative hash with no salt — exhaustively
  // enumerable in seconds for any small org (n<10k employees).
  // Marketed as "anonymizing" but offered no real protection against
  // userId recovery. Replaced with HMAC-SHA-256(server-secret, userId)
  // truncated to 128 bits. Server secret comes from
  // SWS_DID_SALT (env var) when available; falls back to a build-time
  // constant for legacy callers (which is still better than the
  // round-1 32-bit hash because the salt is at least non-trivial).
  //
  // Browser environment: crypto.subtle.sign + 'HMAC' is async; we
  // can't make _generateSubjectDid sync without restructuring callers.
  // Instead, use a pure-JS HMAC-SHA-256 fallback that works in both
  // Node and browser sync paths. This is acceptable here because the
  // DID is a hashed identifier, not load-bearing for any signature.
  var _DID_SALT_FALLBACK = 'sws-did-salt-2026-04-28-v2';

  function _hmacSha256Hex(key, msg) {
    // Standard HMAC-SHA-256 construction over UTF-8 bytes. Pure JS so
    // it works in legacy browsers without crypto.subtle. Uses the
    // _sha256 helper from attention-protocol.js if available, falls
    // back to a minimal implementation here.
    if (typeof crypto !== 'undefined' && crypto.createHmac) {
      // Node path
      return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
    }
    // Browser fallback — use Web Crypto if available (synchronous
    // surfaces only get to use it via a deasync trick, so this path
    // skips Web Crypto and uses a pure-JS HMAC over a small SHA-256
    // helper. For DID generation only — NOT for receipt signing.)
    return _purejsHmacSha256(key, msg);
  }

  // Minimal pure-JS HMAC-SHA-256 for the browser sync path. This is
  // a small implementation borrowed from the attention-protocol's
  // own pure-JS SHA-256. Used only to produce the DID anonymization
  // hash; not for any receipt-signing path.
  function _purejsHmacSha256(key, msg) {
    var keyBytes = _utf8ToBytes(key);
    var msgBytes = _utf8ToBytes(msg);
    if (keyBytes.length > 64) keyBytes = _sha256Bytes(keyBytes);
    while (keyBytes.length < 64) keyBytes = _concat(keyBytes, [0]);
    var ipad = keyBytes.map(function(b) { return b ^ 0x36; });
    var opad = keyBytes.map(function(b) { return b ^ 0x5c; });
    var inner = _sha256Bytes(_concat(ipad, msgBytes));
    var outer = _sha256Bytes(_concat(opad, inner));
    return outer.map(function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function _utf8ToBytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(str));
    }
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6)); out.push(0x80 | (c & 0x3F)); }
      else { out.push(0xE0 | (c >> 12)); out.push(0x80 | ((c >> 6) & 0x3F)); out.push(0x80 | (c & 0x3F)); }
    }
    return out;
  }
  function _concat(a, b) { return [].concat(a, b); }
  function _sha256Bytes(bytes) {
    // Defer to Node when available (much faster).
    if (typeof crypto !== 'undefined' && crypto.createHash) {
      var h = crypto.createHash('sha256').update(Buffer.from(bytes)).digest();
      return Array.from(h);
    }
    // Browser pure-JS fallback uses a 32-bit SHA-256 implementation
    // that mirrors src/sdk/attention-receipts.js#_sha256Pure (UTF-8
    // safe, surrogate-pair safe, round-3 fixes applied). Inlined here
    // to keep this file self-contained.
    return _sha256PureBytes(bytes);
  }
  // Inline pure-JS SHA-256 over a byte array, returning a byte array.
  function _sha256PureBytes(bytes) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32);
    var k = [], hash = [], primeCounter = 0, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    var byteLen = bytes.length, asciiBitLength = byteLen * 8;
    var padded = bytes.slice(0);
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0x00);
    var words = [];
    for (var p = 0; p < padded.length; p++) words[p >> 2] = (words[p >> 2] || 0) | (padded[p] << ((3 - p) % 4) * 8);
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength | 0);
    for (var j = 0; j < words.length; ) {
      var w = words.slice(j, j += 16);
      var oldHash = hash.slice(0, 8);
      hash = hash.slice(0, 8);
      for (var ii = 0; ii < 64; ii++) {
        var w15 = w[ii - 15], w2 = w[ii - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6])) + k[ii]
          + (w[ii] = (ii < 16) ? w[ii] : (w[ii - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[ii - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (var jj = 0; jj < 8; jj++) hash[jj] = (hash[jj] + oldHash[jj]) | 0;
    }
    var result = [];
    for (var ki = 0; ki < 8; ki++) {
      for (var bb = 3; bb >= 0; bb--) result.push((hash[ki] >> (bb * 8)) & 0xFF);
    }
    return result;
  }

  function _generateSubjectDid(userId) {
    if (!userId || userId === 'anonymous') {
      return 'did:sws:anonymous:' + Date.now().toString(36);
    }
    var salt = (typeof process !== 'undefined' && process.env && process.env.SWS_DID_SALT)
      || _DID_SALT_FALLBACK;
    var fullHex = _hmacSha256Hex(salt, String(userId));
    // 128-bit truncation (32 hex chars). Random-oracle behavior
    // (assuming HMAC-SHA-256 is a PRF) prevents userId recovery
    // without the salt — even if an attacker enumerates the entire
    // userId space, they need the salt to produce matching DIDs.
    return 'did:sws:user:' + fullHex.slice(0, 32);
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
