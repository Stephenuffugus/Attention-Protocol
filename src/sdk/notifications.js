/**
 * SWS Attention Protocol — Push Notification System
 * Handles push notification registration, delivery tracking,
 * and notification tap rewards (2 hashes per tap, 3 taps/day max).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window, navigator) {
  'use strict';

  var NOTIF_KEY = 'sws_notification_state';
  var DAILY_TAP_MAX = 3;
  var HASHES_PER_TAP = 2;

  // ============================================================
  // STATE
  // ============================================================

  var _notifState = {
    permission: 'default',
    tapsToday: 0,
    tapDate: '',
    registration: null,
    swRegistration: null
  };

  // ============================================================
  // PERMISSION REQUEST
  // ============================================================

  /**
   * Request push notification permission.
   * Returns promise resolving to: 'granted', 'denied', or 'default'
   */
  function requestPermission(callback) {
    if (!('Notification' in window)) {
      callback('unsupported');
      return;
    }

    if (Notification.permission === 'granted') {
      _notifState.permission = 'granted';
      callback('granted');
      return;
    }

    if (Notification.permission === 'denied') {
      _notifState.permission = 'denied';
      callback('denied');
      return;
    }

    Notification.requestPermission().then(function(result) {
      _notifState.permission = result;
      _saveState();
      callback(result);
    });
  }

  // ============================================================
  // SERVICE WORKER REGISTRATION (for push)
  // ============================================================

  /**
   * Register the service worker for push notifications.
   * @param {string} swPath - Path to service worker file
   * @param {string} vapidKey - VAPID public key for push subscription
   */
  function registerServiceWorker(swPath, vapidKey, callback) {
    if (!('serviceWorker' in navigator)) {
      callback(null, 'Service workers not supported');
      return;
    }

    navigator.serviceWorker.register(swPath || '/sw.js')
      .then(function(registration) {
        _notifState.swRegistration = registration;

        // Subscribe to push
        if (vapidKey) {
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: _urlBase64ToUint8Array(vapidKey)
          }).then(function(subscription) {
            _notifState.registration = subscription;
            _saveState();
            callback(subscription, null);
          }).catch(function(err) {
            callback(null, err.message);
          });
        } else {
          callback(registration, null);
        }
      })
      .catch(function(err) {
        callback(null, err.message);
      });
  }

  // ============================================================
  // NOTIFICATION TAP REWARDS
  // ============================================================

  /**
   * Record a notification tap event.
   * Awards 2 hashes per tap, max 3 taps per day.
   * Call this when the app detects it was opened via a push notification.
   */
  function recordNotificationTap(notificationId) {
    _loadState();
    _resetDayIfNeeded();

    if (_notifState.tapsToday >= DAILY_TAP_MAX) {
      return {
        rewarded: false,
        reason: 'daily_cap_reached',
        tapsToday: _notifState.tapsToday,
        maxTaps: DAILY_TAP_MAX,
        hashesAwarded: 0
      };
    }

    _notifState.tapsToday++;
    _saveState();

    // Award hashes
    var hashesAwarded = 0;
    if (typeof window.SWSAttention !== 'undefined') {
      for (var i = 0; i < HASHES_PER_TAP; i++) {
        window.SWSAttention.earn('notification_tap', 0, 1, 'active');
        hashesAwarded++;
      }
    }

    return {
      rewarded: true,
      reason: 'ok',
      tapsToday: _notifState.tapsToday,
      maxTaps: DAILY_TAP_MAX,
      hashesAwarded: hashesAwarded,
      remainingTaps: DAILY_TAP_MAX - _notifState.tapsToday,
      notificationId: notificationId
    };
  }

  /**
   * Check if the app was opened from a notification.
   * Detects via URL parameter or sessionStorage flag set by service worker.
   */
  function checkNotificationOpen() {
    // Method 1: URL parameter
    var params = new URLSearchParams(window.location.search);
    if (params.get('sws_notif')) {
      var notifId = params.get('sws_notif');
      // Clean the URL
      var cleanUrl = window.location.href.replace(/[?&]sws_notif=[^&]+/, '');
      window.history.replaceState(null, '', cleanUrl);
      return recordNotificationTap(notifId);
    }

    // Method 2: sessionStorage flag (set by service worker)
    var notifFlag = sessionStorage.getItem('sws_notif_tap');
    if (notifFlag) {
      sessionStorage.removeItem('sws_notif_tap');
      return recordNotificationTap(notifFlag);
    }

    return null;
  }

  // ============================================================
  // SEND LOCAL NOTIFICATION
  // ============================================================

  /**
   * Send a local notification (useful for engagement nudges).
   * @param {string} title - Notification title
   * @param {Object} options - Notification options (body, icon, tag, etc.)
   */
  function sendLocalNotification(title, options) {
    if (Notification.permission !== 'granted') return false;

    options = options || {};
    options.tag = options.tag || 'sws_' + Date.now();
    options.data = options.data || {};
    options.data.sws_notif_id = options.tag;

    if (_notifState.swRegistration) {
      _notifState.swRegistration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }

    return true;
  }

  /**
   * Schedule an engagement nudge notification.
   * Shows after a period of inactivity to bring the user back.
   */
  function scheduleEngagementNudge(delayMs, title, body) {
    delayMs = delayMs || 3600000; // Default 1 hour
    title = title || 'Your attention has value';
    body = body || 'Come back and keep earning. Your Focus Score awaits.';

    setTimeout(function() {
      if (document.hidden) {
        sendLocalNotification(title, {
          body: body,
          tag: 'sws_nudge',
          requireInteraction: false
        });
      }
    }, delayMs);
  }

  // ============================================================
  // STATE PERSISTENCE
  // ============================================================

  function _loadState() {
    try {
      var stored = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
      _notifState.tapsToday = stored.tapsToday || 0;
      _notifState.tapDate = stored.tapDate || '';
      _notifState.permission = stored.permission || Notification.permission || 'default';
    } catch (e) { /* defaults */ }
  }

  function _saveState() {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify({
        tapsToday: _notifState.tapsToday,
        tapDate: _notifState.tapDate || _getTodayKey(),
        permission: _notifState.permission
      }));
    } catch (e) { /* non-critical */ }
  }

  function _resetDayIfNeeded() {
    var today = _getTodayKey();
    if (_notifState.tapDate !== today) {
      _notifState.tapsToday = 0;
      _notifState.tapDate = today;
      _saveState();
    }
  }

  function _getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ============================================================
  // STATS
  // ============================================================

  function getNotificationStats() {
    _loadState();
    _resetDayIfNeeded();
    return {
      permission: _notifState.permission,
      tapsToday: _notifState.tapsToday,
      maxTapsPerDay: DAILY_TAP_MAX,
      hashesPerTap: HASHES_PER_TAP,
      remainingTaps: Math.max(0, DAILY_TAP_MAX - _notifState.tapsToday),
      potentialHashes: Math.max(0, DAILY_TAP_MAX - _notifState.tapsToday) * HASHES_PER_TAP
    };
  }

  // ============================================================
  // AUTO-CHECK ON LOAD
  // ============================================================

  _loadState();
  // Auto-check if opened from notification
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkNotificationOpen);
  } else {
    checkNotificationOpen();
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSNotifications = {
    requestPermission: requestPermission,
    registerServiceWorker: registerServiceWorker,
    recordNotificationTap: recordNotificationTap,
    checkNotificationOpen: checkNotificationOpen,
    sendLocalNotification: sendLocalNotification,
    scheduleEngagementNudge: scheduleEngagementNudge,
    getNotificationStats: getNotificationStats
  };

})(window, navigator);
