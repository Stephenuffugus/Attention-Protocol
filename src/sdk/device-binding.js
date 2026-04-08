/**
 * SWS Attention Protocol — WebAuthn Device Binding
 *
 * Binds attention receipts to hardware-verified devices using WebAuthn/Passkeys.
 * When a device is enrolled, each receipt carries a cryptographic signature
 * proving it came from a real device with a real authenticator (TPM, Secure Enclave).
 *
 * This makes it cryptographically expensive to farm attention across bot instances —
 * each receipt is tied to specific hardware.
 *
 * Usage:
 *   SWSDeviceBinding.init();
 *   SWSDeviceBinding.enroll()           → registers device (one-time)
 *   SWSDeviceBinding.sign(receiptHash)  → produces device attestation for a receipt
 *   SWSDeviceBinding.verify(receipt)    → checks device signature is valid
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(window) {
  'use strict';

  var DEVICE_KEY = 'sws_device_credential';
  var _initialized = false;
  var _credential = null; // stored credential ID
  var _available = false;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    _initialized = true;

    // Check WebAuthn support
    _available = !!(window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function');

    // Load stored credential
    try {
      var stored = localStorage.getItem(DEVICE_KEY);
      if (stored) _credential = JSON.parse(stored);
    } catch(e) {}

    return { available: _available, enrolled: !!_credential };
  }

  // ============================================================
  // DEVICE ENROLLMENT (one-time per device)
  // ============================================================

  /**
   * Register this device with WebAuthn.
   * Creates a credential bound to the device's authenticator.
   * Returns a promise resolving to the enrollment status.
   */
  function enroll(userId) {
    if (!_available) {
      return Promise.resolve({
        enrolled: false,
        reason: 'webauthn_not_available',
        fallback: 'device_fingerprint'
      });
    }

    if (_credential) {
      return Promise.resolve({
        enrolled: true,
        reason: 'already_enrolled',
        credentialId: _credential.id
      });
    }

    var challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    var createOptions = {
      publicKey: {
        rp: {
          name: 'SWS Attention Protocol',
          id: _getRpId()
        },
        user: {
          id: _stringToBuffer(userId || 'sws_user_' + Date.now()),
          name: userId || 'attention_device',
          displayName: 'SWS Attention Device'
        },
        challenge: challenge,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256 (ECDSA w/ P-256)
          { type: 'public-key', alg: -257 }   // RS256 (RSASSA-PKCS1-v1_5)
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Use device's built-in authenticator
          userVerification: 'preferred',       // Biometric if available
          residentKey: 'preferred'
        },
        attestation: 'direct' // Request attestation to prove device type
      }
    };

    return navigator.credentials.create(createOptions)
      .then(function(credential) {
        var credData = {
          id: _bufferToBase64(credential.rawId),
          type: credential.type,
          enrolled_at: Date.now(),
          authenticator_type: 'platform',
          attestation_format: credential.response.attestationObject
            ? 'present' : 'none'
        };

        _credential = credData;
        try {
          localStorage.setItem(DEVICE_KEY, JSON.stringify(credData));
        } catch(e) {}

        return {
          enrolled: true,
          credentialId: credData.id,
          authenticator_type: 'platform'
        };
      })
      .catch(function(err) {
        return {
          enrolled: false,
          reason: err.name + ': ' + err.message,
          fallback: 'device_fingerprint'
        };
      });
  }

  // ============================================================
  // RECEIPT SIGNING (per receipt)
  // ============================================================

  /**
   * Sign a receipt hash with the device's authenticator.
   * This binds the receipt to this specific hardware device.
   *
   * @param {string} receiptHash - The SHA-256 hash of the receipt
   * @returns {Promise<Object>} Device attestation object to embed in receipt
   */
  function sign(receiptHash) {
    if (!_available || !_credential) {
      return Promise.resolve(_softwareAttestation(receiptHash));
    }

    var challenge = _stringToBuffer(receiptHash);

    var getOptions = {
      publicKey: {
        challenge: challenge,
        rpId: _getRpId(),
        allowCredentials: [{
          type: 'public-key',
          id: _base64ToBuffer(_credential.id)
        }],
        timeout: 30000,
        userVerification: 'preferred'
      }
    };

    return navigator.credentials.get(getOptions)
      .then(function(assertion) {
        return {
          type: 'webauthn',
          credential_id: _credential.id,
          signature: _bufferToBase64(assertion.response.signature),
          authenticator_data: _bufferToBase64(assertion.response.authenticatorData),
          client_data: _bufferToBase64(assertion.response.clientDataJSON),
          timestamp: Date.now(),
          device_bound: true
        };
      })
      .catch(function(err) {
        // Fall back to software attestation if user cancels or error
        return _softwareAttestation(receiptHash);
      });
  }

  /**
   * Software fallback when WebAuthn is unavailable.
   * Uses device fingerprint signals as a weaker binding.
   */
  function _softwareAttestation(receiptHash) {
    var fingerprint = _computeDeviceFingerprint();
    return {
      type: 'software',
      fingerprint_hash: fingerprint,
      receipt_hash: receiptHash,
      timestamp: Date.now(),
      device_bound: false,
      signals: {
        screen: screen.width + 'x' + screen.height,
        color_depth: screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        hardware_concurrency: navigator.hardwareConcurrency || 0,
        device_memory: navigator.deviceMemory || 0
      }
    };
  }

  // ============================================================
  // VERIFICATION
  // ============================================================

  /**
   * Check if a receipt's device binding is present and consistent.
   * Full cryptographic verification requires the stored public key
   * and happens server-side. This is the client-side plausibility check.
   */
  function verify(deviceAttestation) {
    if (!deviceAttestation) {
      return { valid: false, reason: 'no_device_attestation' };
    }

    if (deviceAttestation.type === 'webauthn') {
      return {
        valid: true,
        type: 'hardware',
        device_bound: true,
        credential_id: deviceAttestation.credential_id,
        has_signature: !!deviceAttestation.signature,
        note: 'Full verification requires server-side public key check'
      };
    }

    if (deviceAttestation.type === 'software') {
      // Check if fingerprint matches current device
      var currentFingerprint = _computeDeviceFingerprint();
      return {
        valid: deviceAttestation.fingerprint_hash === currentFingerprint,
        type: 'software',
        device_bound: false,
        same_device: deviceAttestation.fingerprint_hash === currentFingerprint,
        note: 'Software attestation — weaker than hardware binding'
      };
    }

    return { valid: false, reason: 'unknown_attestation_type' };
  }

  // ============================================================
  // STATUS
  // ============================================================

  function getStatus() {
    return {
      available: _available,
      enrolled: !!_credential,
      credential_id: _credential ? _credential.id : null,
      enrolled_at: _credential ? _credential.enrolled_at : null,
      type: _available ? 'webauthn' : 'software_fallback'
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _getRpId() {
    // Use current hostname as relying party ID
    try { return window.location.hostname; }
    catch(e) { return 'sws-attention-proofs.web.app'; }
  }

  function _stringToBuffer(str) {
    var encoder = new TextEncoder();
    return encoder.encode(str);
  }

  function _bufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function _base64ToBuffer(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function _computeDeviceFingerprint() {
    var signals = [
      screen.width, screen.height, screen.colorDepth,
      navigator.language, navigator.platform,
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
      new Date().getTimezoneOffset()
    ].join('|');

    // Simple hash of signals
    var hash = 0;
    for (var i = 0; i < signals.length; i++) {
      var chr = signals.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'swsdf_' + Math.abs(hash).toString(36);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSDeviceBinding = {
    init: init,
    enroll: enroll,
    sign: sign,
    verify: verify,
    getStatus: getStatus
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.SWSDeviceBinding;
  }

})(typeof window !== 'undefined' ? window : global);
