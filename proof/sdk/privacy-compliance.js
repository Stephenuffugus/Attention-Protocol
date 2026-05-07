/**
 * SWS Attention Protocol — Privacy Compliance Module
 * Handles consent management, data export (GDPR/CCPA), and
 * user history deletion. COPPA-compliant by architecture.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window, document) {
  'use strict';

  var CONSENT_KEY = 'sws_consent';
  var HASHES_KEY = 'sws_attention_hashes';
  var BALANCE_KEY = 'sws_hash_balance';

  // In-memory fallback when localStorage is unavailable (iOS Safari
  // Private Mode throws QuotaExceededError on setItem; some enterprise
  // browser policies disable storage entirely). Without this, the consent
  // click handler would throw before container.remove() ran — banner
  // never closed, "Accept" silently did nothing on retry.
  var _memoryStore = {};
  function _safeGet(key) {
    try { return localStorage.getItem(key); }
    catch (_e) { return _memoryStore[key] != null ? _memoryStore[key] : null; }
  }
  function _safeSet(key, value) {
    _memoryStore[key] = value;
    try { localStorage.setItem(key, value); } catch (_e) { /* storage disabled */ }
  }

  // ============================================================
  // CONSENT MANAGEMENT
  // ============================================================

  var ConsentTypes = {
    ATTENTION_TRACKING: 'attention_tracking',    // Core hash generation
    BEHAVIORAL_ANALYSIS: 'behavioral_analysis',  // Fitts', Hick's, timing entropy
    CLOUD_SYNC: 'cloud_sync',                    // Firestore vault sync
    FITNESS_BRIDGE: 'fitness_bridge',            // Google Fit / Strava
    BROWSER_EXTENSION: 'browser_extension',      // Grove Keeper
    PUSH_NOTIFICATIONS: 'push_notifications'     // Notification tap rewards
  };

  /**
   * Get current consent state.
   * Returns object with each consent type and its boolean status.
   */
  function getConsent() {
    try {
      var stored = JSON.parse(_safeGet(CONSENT_KEY) || '{}');
      return {
        attention_tracking: stored.attention_tracking || false,
        behavioral_analysis: stored.behavioral_analysis || false,
        cloud_sync: stored.cloud_sync || false,
        fitness_bridge: stored.fitness_bridge || false,
        browser_extension: stored.browser_extension || false,
        push_notifications: stored.push_notifications || false,
        timestamp: stored.timestamp || null,
        version: stored.version || null
      };
    } catch (e) {
      return _defaultConsent();
    }
  }

  function _defaultConsent() {
    return {
      attention_tracking: false,
      behavioral_analysis: false,
      cloud_sync: false,
      fitness_bridge: false,
      browser_extension: false,
      push_notifications: false,
      timestamp: null,
      version: null
    };
  }

  /**
   * Record user consent. All tracking is opt-in.
   */
  function setConsent(consentObj) {
    var current = getConsent();
    for (var key in consentObj) {
      if (consentObj.hasOwnProperty(key) && current.hasOwnProperty(key)) {
        current[key] = !!consentObj[key];
      }
    }
    current.timestamp = Date.now();
    current.version = '1.0';

    _safeSet(CONSENT_KEY, JSON.stringify(current));

    // Sync consent to Firestore if authenticated and cloud_sync is approved
    if (current.cloud_sync && typeof firebase !== 'undefined') {
      try { _syncConsentToCloud(current); } catch (_e) { /* non-blocking */ }
    }

    return current;
  }

  /**
   * Revoke all consent and stop all tracking.
   */
  function revokeAllConsent() {
    var revoked = _defaultConsent();
    revoked.timestamp = Date.now();
    revoked.version = '1.0';
    _safeSet(CONSENT_KEY, JSON.stringify(revoked));
    return revoked;
  }

  /**
   * Check if a specific tracking type is consented.
   */
  function hasConsent(consentType) {
    var consent = getConsent();
    return consent[consentType] === true;
  }

  /**
   * Extract a receipt-ready consent attestation snapshot.
   * Shape matches what attention-receipts.generateReceipt() expects.
   * Returns null if no consent record exists (receipt will record "no consent").
   */
  function getReceiptAttestation(opts) {
    opts = opts || {};
    var consent = getConsent();
    if (!consent.timestamp) return null;

    var granted = [];
    if (consent.attention_tracking)   granted.push('attention_tracking');
    if (consent.behavioral_analysis)  granted.push('behavioral_analysis');
    if (consent.cloud_sync)           granted.push('cloud_sync');
    if (consent.fitness_bridge)       granted.push('fitness_bridge');
    if (consent.browser_extension)    granted.push('browser_extension');
    if (consent.push_notifications)   granted.push('push_notifications');

    return {
      granted: granted.length > 0,
      categories: granted,
      timestamp: consent.timestamp
        ? new Date(consent.timestamp).toISOString()
        : null,
      version: consent.version || '1.0',
      policy_url: opts.policyUrl || null
    };
  }

  function _syncConsentToCloud(consent) {
    try {
      var user = firebase.auth().currentUser;
      if (!user) return;
      firebase.firestore().collection('vaults').doc(user.uid)
        .set({ consent: consent }, { merge: true });
    } catch (e) { /* non-critical */ }
  }

  // ============================================================
  // DATA EXPORT (GDPR Article 20 / CCPA)
  // ============================================================

  /**
   * Export all user data as a structured JSON object.
   * This fulfills GDPR right to data portability and CCPA right to know.
   */
  function exportAllData(callback) {
    var exportData = {
      export_version: '1.0',
      export_timestamp: new Date().toISOString(),
      protocol: 'SWS Proof of Attention Protocol',
      entity: 'SWS Strategic Media LLC',

      // Consent record
      consent: getConsent(),

      // Local attention hashes
      local_hashes: _getLocalHashes(),

      // Local balance
      local_balance: parseInt(localStorage.getItem(BALANCE_KEY) || '0', 10),

      // What we collect (transparency)
      data_categories: {
        collected: [
          'Aggregate time durations',
          'Interaction counts (taps, scrolls, keystrokes — numbers only)',
          'Step counts (from accelerometer or fitness API)',
          'SHA-256 hashes of attention payloads',
          'User-chosen display names and game-specific data'
        ],
        never_collected: [
          'Specific URLs visited',
          'App names used',
          'Message content',
          'Keystroke content (count only)',
          'Location data beyond opt-in geo-features',
          'Personal identification data',
          'Biometric data',
          'Browsing history',
          'Health data (weight, heart rate, etc.)'
        ]
      },

      // Cloud data (if authenticated)
      cloud_data: null
    };

    // Attempt to fetch cloud data
    if (typeof firebase !== 'undefined') {
      try {
        var user = firebase.auth().currentUser;
        if (user) {
          _exportCloudData(user.uid, function(cloudData) {
            exportData.cloud_data = cloudData;
            callback(exportData);
          });
          return;
        }
      } catch (e) { /* fall through */ }
    }

    callback(exportData);
  }

  function _getLocalHashes() {
    try {
      return JSON.parse(localStorage.getItem(HASHES_KEY) || '[]');
    } catch (e) { return []; }
  }

  function _exportCloudData(uid, callback) {
    var cloudData = {
      uid: uid,
      hashes: [],
      balance: null,
      spends: []
    };

    var db = firebase.firestore();
    var completed = 0;
    var total = 3;

    function checkDone() {
      completed++;
      if (completed >= total) callback(cloudData);
    }

    // Hashes
    db.collection('vaults').doc(uid).collection('hashes')
      .orderBy('timestamp', 'desc').limit(10000)
      .get()
      .then(function(snap) {
        snap.forEach(function(doc) { cloudData.hashes.push(doc.data()); });
        checkDone();
      })
      .catch(function() { checkDone(); });

    // Balance
    db.collection('vaults').doc(uid).collection('balance').doc('current')
      .get()
      .then(function(doc) {
        if (doc.exists) cloudData.balance = doc.data();
        checkDone();
      })
      .catch(function() { checkDone(); });

    // Spends
    db.collection('vaults').doc(uid).collection('spends')
      .orderBy('timestamp', 'desc').limit(10000)
      .get()
      .then(function(snap) {
        snap.forEach(function(doc) { cloudData.spends.push(doc.data()); });
        checkDone();
      })
      .catch(function() { checkDone(); });
  }

  /**
   * Download exported data as a JSON file.
   */
  function downloadExport() {
    exportAllData(function(data) {
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'sws-attention-data-export-' + new Date().toISOString().split('T')[0] + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ============================================================
  // DATA DELETION (GDPR Article 17 — Right to Erasure)
  // ============================================================

  /**
   * Delete all user attention data permanently.
   * Clears localStorage and Firestore vault.
   */
  function deleteAllData(callback) {
    var result = {
      localCleared: false,
      cloudCleared: false,
      errors: []
    };

    // Clear localStorage
    try {
      localStorage.removeItem(HASHES_KEY);
      localStorage.removeItem(BALANCE_KEY);
      localStorage.removeItem('sws_daily_caps');
      localStorage.removeItem('sws_tab_hidden_at');
      // Preserve consent record (they need to be able to re-consent)
      result.localCleared = true;
    } catch (e) {
      result.errors.push('localStorage: ' + e.message);
    }

    // Clear Firestore vault
    if (typeof firebase !== 'undefined') {
      try {
        var user = firebase.auth().currentUser;
        if (user) {
          _deleteCloudData(user.uid, function(success, errors) {
            result.cloudCleared = success;
            if (errors) result.errors = result.errors.concat(errors);
            callback(result);
          });
          return;
        }
      } catch (e) {
        result.errors.push('firebase: ' + e.message);
      }
    }

    callback(result);
  }

  function _deleteCloudData(uid, callback) {
    var db = firebase.firestore();
    var errors = [];
    var completed = 0;
    var total = 3;

    function checkDone(err) {
      if (err) errors.push(err);
      completed++;
      if (completed >= total) {
        callback(errors.length === 0, errors.length > 0 ? errors : null);
      }
    }

    // Delete all hashes (batch delete, max 500 per batch per Firestore limits)
    _deleteCollection(db, 'vaults/' + uid + '/hashes', 500, function(err) {
      checkDone(err ? 'hashes: ' + err : null);
    });

    // Delete all spends
    _deleteCollection(db, 'vaults/' + uid + '/spends', 500, function(err) {
      checkDone(err ? 'spends: ' + err : null);
    });

    // Delete balance document
    db.collection('vaults').doc(uid).collection('balance').doc('current')
      .delete()
      .then(function() { checkDone(); })
      .catch(function(e) { checkDone('balance: ' + e.message); });
  }

  function _deleteCollection(db, path, batchSize, callback) {
    var collRef = db.collection(path);
    var query = collRef.orderBy('__name__').limit(batchSize);

    function deleteBatch() {
      query.get().then(function(snapshot) {
        if (snapshot.size === 0) { callback(null); return; }

        var batch = db.batch();
        snapshot.docs.forEach(function(doc) { batch.delete(doc.ref); });

        batch.commit().then(function() {
          if (snapshot.size < batchSize) { callback(null); }
          else { deleteBatch(); } // More to delete
        }).catch(function(e) { callback(e.message); });
      }).catch(function(e) { callback(e.message); });
    }

    deleteBatch();
  }

  // ============================================================
  // CONSENT UI BUILDER
  // ============================================================

  /**
   * Generate a consent banner/modal HTML string.
   * Integrators can use this or build their own UI calling setConsent().
   */
  function buildConsentUI(options) {
    options = options || {};
    // Hard-enum validation — these values land in the banner's inline
    // style attribute via string concatenation, so an attacker-controllable
    // `position` would otherwise be a CSS-injection sink. Finding: audit Apr 21.
    var theme = options.theme === 'light' ? 'light' : 'dark';
    var position = options.position === 'top' ? 'top' : 'bottom';

    var bg = theme === 'dark' ? '#111827' : '#ffffff';
    var text = theme === 'dark' ? '#f1f5f9' : '#1e293b';
    var dim = theme === 'dark' ? '#94a3b8' : '#64748b';
    var accent = '#06b6d4';

    // Round-7 R3-NEW-11 a11y fixes:
    //  - role="dialog" + aria-modal + aria-labelledby for the banner
    //  - aria-label on the inline buttons + min-height 44px (WCAG 2.5.5)
    //  - "Learn more" link has a real handler (was a dead # anchor that
    //    jumped to top of page)
    //  - Heading element id'd for aria-labelledby
    var html = '' +
      '<div id="sws-consent-banner" role="dialog" aria-modal="true" aria-labelledby="sws-consent-heading" style="' +
        'position:fixed;' + position + ':0;left:0;right:0;z-index:99999;' +
        'background:' + bg + ';border-top:1px solid ' + dim + ';' +
        'padding:20px 24px calc(20px + env(safe-area-inset-bottom,0px)) 24px;' +
        'font-family:-apple-system,sans-serif;color:' + text + ';' +
        'box-shadow:0 -4px 20px rgba(0,0,0,0.3);' +
        'max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
        'box-sizing:border-box;">' +
        '<div style="max-width:900px;margin:0 auto;">' +
          '<h2 id="sws-consent-heading" style="margin:0 0 8px;font-size:15px;font-weight:600;color:' + text + ';">Consent to attention tracking</h2>' +
          '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:' + dim + ';">' +
            'This site uses the SWS Attention Protocol to measure engagement quality. ' +
            'We track <strong>how long</strong> you engage, not <strong>what</strong> you do. ' +
            'No personal data, URLs, or content is ever recorded. ' +
            '<a href="/privacy.html" id="sws-consent-details" style="color:' + accent + ';" target="_blank" rel="noopener">Learn more about what is collected</a>' +
          '</p>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
            '<label style="font-size:13px;color:' + dim + ';cursor:pointer;min-height:44px;display:flex;align-items:center;gap:6px;">' +
              '<input type="checkbox" id="sws-consent-tracking" checked aria-describedby="sws-consent-heading"> Attention tracking' +
            '</label>' +
            '<label style="font-size:13px;color:' + dim + ';cursor:pointer;min-height:44px;display:flex;align-items:center;gap:6px;">' +
              '<input type="checkbox" id="sws-consent-behavioral" checked aria-describedby="sws-consent-heading"> Behavioral analysis' +
            '</label>' +
            '<label style="font-size:13px;color:' + dim + ';cursor:pointer;min-height:44px;display:flex;align-items:center;gap:6px;">' +
              '<input type="checkbox" id="sws-consent-sync" aria-describedby="sws-consent-heading"> Cloud sync' +
            '</label>' +
            '<div style="flex:1;"></div>' +
            '<button id="sws-consent-accept" aria-label="Accept the selected consent options" style="' +
              'background:' + accent + ';color:#fff;border:none;padding:12px 24px;min-height:44px;' +
              'border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Accept</button>' +
            '<button id="sws-consent-reject" aria-label="Decline all tracking and analysis" style="' +
              'background:transparent;color:' + dim + ';border:1px solid ' + dim + ';' +
              'padding:12px 24px;min-height:44px;border-radius:6px;font-size:14px;cursor:pointer;">Decline All</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    return html;
  }

  /**
   * Show the consent banner and wire up buttons.
   */
  function showConsentBanner(options) {
    // Don't show if already consented
    var current = getConsent();
    if (current.timestamp) return;

    var container = document.createElement('div');
    container.innerHTML = buildConsentUI(options);
    document.body.appendChild(container);

    // Round-7 R3-NEW-11 a11y: shift focus to the banner's primary
    // action so SR + keyboard-only users land on the consent decision
    // immediately. Without this, SR users get no announcement that a
    // modal demands their attention; keyboard users have to Tab from
    // body all the way to the banner.
    var acceptBtn = document.getElementById('sws-consent-accept');
    var rejectBtn = document.getElementById('sws-consent-reject');
    if (acceptBtn && acceptBtn.focus) {
      try { acceptBtn.focus(); } catch (_e) { /* old browsers */ }
    }

    acceptBtn.addEventListener('click', function() {
      try {
        setConsent({
          attention_tracking: document.getElementById('sws-consent-tracking').checked,
          behavioral_analysis: document.getElementById('sws-consent-behavioral').checked,
          cloud_sync: document.getElementById('sws-consent-sync').checked
        });
      } catch (_e) { /* in-memory fallback handles persistence */ }
      try { container.remove(); } catch (_e) { /* already detached */ }
    });

    rejectBtn.addEventListener('click', function() {
      try { revokeAllConsent(); } catch (_e) { /* in-memory fallback */ }
      try { container.remove(); } catch (_e) { /* already detached */ }
    });
  }

  // ============================================================
  // COPPA COMPLIANCE VERIFICATION
  // ============================================================

  /**
   * Verify that no PII exists in a hash payload.
   * Returns { compliant: boolean, violations: string[] }
   */
  function verifyCOPPA(payload) {
    var violations = [];

    // Check for fields that should NOT be in payload
    var prohibited = ['email', 'name', 'phone', 'address', 'url', 'ip', 'device_id',
                      'birthday', 'age', 'gender', 'photo', 'location'];
    prohibited.forEach(function(field) {
      if (payload[field] !== undefined) {
        violations.push('Prohibited field found: ' + field);
      }
    });

    // Verify user_uid is not an email
    if (payload.user_uid && payload.user_uid.indexOf('@') !== -1) {
      violations.push('user_uid contains email address');
    }

    // Verify no URL patterns in string fields
    var urlPattern = /https?:\/\/[^\s]+/;
    for (var key in payload) {
      if (typeof payload[key] === 'string' && urlPattern.test(payload[key])) {
        violations.push('URL detected in field: ' + key);
      }
    }

    return {
      compliant: violations.length === 0,
      violations: violations
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================

  var SWSPrivacy = {
    ConsentTypes: ConsentTypes,
    getConsent: getConsent,
    setConsent: setConsent,
    revokeAllConsent: revokeAllConsent,
    hasConsent: hasConsent,
    getReceiptAttestation: getReceiptAttestation,
    exportAllData: exportAllData,
    downloadExport: downloadExport,
    deleteAllData: deleteAllData,
    buildConsentUI: buildConsentUI,
    showConsentBanner: showConsentBanner,
    verifyCOPPA: verifyCOPPA
  };

  window.SWSPrivacy = SWSPrivacy;

  // Node / test hook — the module is IIFE-wrapped for browser but we also
  // want to be able to require() it in Jest for unit tests on the
  // getReceiptAttestation/hasConsent shapes without needing a full SDK boot.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SWSPrivacy;
  }

})(window, document);
