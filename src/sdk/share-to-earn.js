/**
 * SWS Attention Protocol — Share-to-Earn Protocol
 * Tracks content sharing, verifies view duration, generates
 * hashes for sharers and viewers. Includes referral system.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window, document) {
  'use strict';

  var SHARE_KEY = 'sws_share_tracking';
  var REFERRAL_KEY = 'sws_referral_code';
  var VIEW_THRESHOLD_MS = 10000; // 10 seconds = verified view

  // ============================================================
  // SHARE LINK GENERATION
  // ============================================================

  /**
   * Generate a trackable share link.
   * @param {string} contentUrl - The content URL to share
   * @param {string} contentType - Type of content (achievement, score, creation, etc.)
   * @returns {Object} { shareUrl, shareId, contentUrl, contentType }
   */
  function createShareLink(contentUrl, contentType) {
    var shareId = _generateShareId();
    var uid = _getCurrentUid();

    var shareRecord = {
      share_id: shareId,
      sharer_uid: uid,
      content_url: contentUrl,
      content_type: contentType || 'general',
      created_at: Date.now(),
      views: [],
      hashes_awarded: false
    };

    // Store locally
    _storeShare(shareRecord);

    // Sync to Firestore for cross-device tracking
    _syncShareToCloud(shareRecord);

    // Build share URL with tracking parameter
    var separator = contentUrl.indexOf('?') === -1 ? '?' : '&';
    var shareUrl = contentUrl + separator + 'sws_share=' + shareId + '&sws_ref=' + uid;

    return {
      shareUrl: shareUrl,
      shareId: shareId,
      contentUrl: contentUrl,
      contentType: contentType
    };
  }

  // ============================================================
  // SHARE VIEW TRACKING
  // ============================================================

  /**
   * Initialize view tracking on a shared page.
   * Call this on pages that may have been reached via a share link.
   * Automatically detects sws_share and sws_ref query parameters.
   */
  function initViewTracking() {
    var params = new URLSearchParams(window.location.search);
    var shareId = params.get('sws_share');
    var refUid = params.get('sws_ref');

    if (!shareId) return null;

    var viewStart = Date.now();
    var viewerUid = _getCurrentUid();
    var interactionCount = 0;
    var maxScrollDepth = 0;

    // Track interactions during view
    function trackViewInteraction() { interactionCount++; }
    function trackViewScroll() {
      var depth = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (depth > maxScrollDepth) maxScrollDepth = depth;
    }

    document.addEventListener('click', trackViewInteraction);
    document.addEventListener('touchstart', trackViewInteraction);
    window.addEventListener('scroll', trackViewScroll);

    // Check view duration when page becomes hidden or after threshold
    var verificationTimer = setTimeout(function() {
      _verifyView(shareId, refUid, viewerUid, viewStart, interactionCount, maxScrollDepth);
    }, VIEW_THRESHOLD_MS + 500);

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        clearTimeout(verificationTimer);
        var viewDuration = Date.now() - viewStart;
        if (viewDuration >= VIEW_THRESHOLD_MS) {
          _verifyView(shareId, refUid, viewerUid, viewStart, interactionCount, maxScrollDepth);
        }
      }
    });

    return {
      shareId: shareId,
      refUid: refUid,
      viewStart: viewStart
    };
  }

  function _verifyView(shareId, sharerUid, viewerUid, viewStart, interactions, scrollDepth) {
    var viewDuration = Date.now() - viewStart;

    if (viewDuration < VIEW_THRESHOLD_MS) return; // Not enough time
    if (viewerUid === sharerUid) return; // Can't view your own share

    var viewRecord = {
      share_id: shareId,
      viewer_uid: viewerUid,
      sharer_uid: sharerUid,
      view_duration_ms: viewDuration,
      interaction_count: interactions,
      scroll_depth_pct: Math.round(scrollDepth),
      verified_at: Date.now(),
      verified: true
    };

    // Award hashes
    // Sharer: 2 hashes for verified share view (share_verified event)
    if (typeof window.SWSAttention !== 'undefined' && sharerUid) {
      // The sharer hashes are banked and awarded on their next session
      _bankSharerReward(sharerUid, shareId, 2);
    }

    // Viewer: 1 hash for spending 10+ seconds (share_viewed event)
    if (typeof window.SWSAttention !== 'undefined') {
      window.SWSAttention.earn('share_viewed', viewDuration, interactions, 'passive');
    }

    // Sync to Firestore
    _syncViewToCloud(viewRecord);
  }

  function _bankSharerReward(sharerUid, shareId, hashCount) {
    // Store banked reward in Firestore for the sharer to claim on next login
    if (typeof firebase === 'undefined') return;

    try {
      firebase.firestore().collection('vaults').doc(sharerUid)
        .collection('banked_rewards').add({
          type: 'share_verified',
          share_id: shareId,
          hash_count: hashCount,
          banked_at: Date.now(),
          claimed: false
        });
    } catch (e) { /* non-critical */ }
  }

  /**
   * Claim any banked share rewards for the current user.
   */
  function claimBankedRewards(callback) {
    var uid = _getCurrentUid();
    if (!uid || uid === 'anonymous' || typeof firebase === 'undefined') {
      callback(0);
      return;
    }

    firebase.firestore().collection('vaults').doc(uid)
      .collection('banked_rewards')
      .where('claimed', '==', false)
      .get()
      .then(function(snapshot) {
        var totalHashes = 0;
        var batch = firebase.firestore().batch();

        snapshot.forEach(function(doc) {
          var reward = doc.data();
          totalHashes += reward.hash_count || 0;
          batch.update(doc.ref, { claimed: true, claimed_at: Date.now() });
        });

        if (totalHashes > 0) {
          batch.commit().then(function() {
            // Award the hashes
            for (var i = 0; i < totalHashes; i++) {
              if (typeof window.SWSAttention !== 'undefined') {
                window.SWSAttention.earn('share_verified', 0, 0, 'active');
              }
            }
            callback(totalHashes);
          });
        } else {
          callback(0);
        }
      })
      .catch(function() { callback(0); });
  }

  // ============================================================
  // REFERRAL SYSTEM
  // ============================================================

  /**
   * Generate a referral code for the current user.
   */
  function getReferralCode() {
    var uid = _getCurrentUid();
    if (!uid || uid === 'anonymous') return null;

    var stored = localStorage.getItem(REFERRAL_KEY);
    if (stored) return stored;

    // Generate a short, memorable code
    var code = 'SWS' + uid.substr(0, 6).toUpperCase();
    localStorage.setItem(REFERRAL_KEY, code);

    // Register in Firestore
    if (typeof firebase !== 'undefined') {
      try {
        firebase.firestore().collection('referral_codes').doc(code).set({
          owner_uid: uid,
          created_at: Date.now(),
          total_signups: 0
        });
      } catch (e) { /* non-critical */ }
    }

    return code;
  }

  /**
   * Apply a referral code during signup.
   * Awards 5 hashes to the referrer.
   */
  function applyReferralCode(code, callback) {
    if (typeof firebase === 'undefined') {
      callback(false, 'firebase_unavailable');
      return;
    }

    firebase.firestore().collection('referral_codes').doc(code)
      .get()
      .then(function(doc) {
        if (!doc.exists) {
          callback(false, 'invalid_code');
          return;
        }

        var referrer = doc.data();
        var newUid = _getCurrentUid();
        if (newUid === referrer.owner_uid) {
          callback(false, 'self_referral');
          return;
        }

        // Record the referral
        firebase.firestore().collection('referral_codes').doc(code)
          .update({
            total_signups: firebase.firestore.FieldValue.increment(1)
          });

        // Bank 5 hashes for the referrer
        _bankSharerReward(referrer.owner_uid, 'referral_' + newUid, 5);

        callback(true, 'referral_applied');
      })
      .catch(function(err) {
        callback(false, err.message);
      });
  }

  // ============================================================
  // WEB SHARE API INTEGRATION
  // ============================================================

  /**
   * Share content using the native Web Share API (mobile).
   * Falls back to clipboard copy on desktop.
   */
  function shareContent(options, callback) {
    var shareLink = createShareLink(options.url || window.location.href, options.type || 'general');

    var shareData = {
      title: options.title || 'Check this out',
      text: options.text || '',
      url: shareLink.shareUrl
    };

    if (navigator.share) {
      navigator.share(shareData)
        .then(function() {
          callback(true, shareLink);
        })
        .catch(function() {
          callback(false, shareLink);
        });
    } else {
      // Fallback: copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareLink.shareUrl)
          .then(function() { callback(true, shareLink); })
          .catch(function() { callback(false, shareLink); });
      } else {
        callback(false, shareLink);
      }
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _generateShareId() {
    return 'shr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function _getCurrentUid() {
    if (typeof firebase !== 'undefined') {
      try {
        var user = firebase.auth().currentUser;
        return user ? user.uid : 'anonymous';
      } catch (e) { return 'anonymous'; }
    }
    return 'anonymous';
  }

  function _storeShare(record) {
    try {
      var shares = JSON.parse(localStorage.getItem(SHARE_KEY) || '[]');
      shares.push(record);
      if (shares.length > 500) shares = shares.slice(-500);
      localStorage.setItem(SHARE_KEY, JSON.stringify(shares));
    } catch (e) { /* storage full */ }
  }

  function _syncShareToCloud(record) {
    if (typeof firebase === 'undefined') return;
    try {
      var user = firebase.auth().currentUser;
      if (!user) return;
      firebase.firestore().collection('shares').doc(record.share_id).set(record);
    } catch (e) { /* non-critical */ }
  }

  function _syncViewToCloud(record) {
    if (typeof firebase === 'undefined') return;
    try {
      firebase.firestore().collection('share_views').add(record);
    } catch (e) { /* non-critical */ }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSShare = {
    createShareLink: createShareLink,
    initViewTracking: initViewTracking,
    claimBankedRewards: claimBankedRewards,
    getReferralCode: getReferralCode,
    applyReferralCode: applyReferralCode,
    shareContent: shareContent
  };

})(window, document);
