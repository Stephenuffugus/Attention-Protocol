/**
 * SWS Attention Protocol — Production Embed Bundle
 * Drop this single file on any page to start generating proof data.
 *
 * Includes: Core SDK + Economy Engine + GA4 Bridge + Proof Collector
 * Wired to: GA4 G-5JFFYEJ6XP | Firebase focus-grove-fffa8
 *
 * Usage: <script src="sws-embed.js"></script>
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function() {
  'use strict';

  // ============================================================
  // FIREBASE CONFIG (focus-grove-fffa8)
  // ============================================================
  // IMPORTANT: Replace apiKey and appId with your real values from
  // Firebase Console > focus-grove-fffa8 > Project Settings > Web App
  // The SDK works offline-first without Firebase, but sync requires real keys.
  var FIREBASE_CONFIG = {
    apiKey: "YOUR_FIREBASE_API_KEY",       // Get from Firebase Console
    authDomain: "focus-grove-fffa8.firebaseapp.com",
    projectId: "focus-grove-fffa8",
    storageBucket: "focus-grove-fffa8.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",   // Get from Firebase Console
    appId: "YOUR_APP_ID"                   // Get from Firebase Console
  };

  var GA4_ID = 'G-5JFFYEJ6XP';
  var GAME_ID = 'steveweetsie_web';

  // ============================================================
  // LOAD DEPENDENCIES
  // ============================================================

  function loadScript(src, callback) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = callback || function() {};
    s.onerror = function() { console.warn('[SWS] Failed to load:', src); };
    document.head.appendChild(s);
  }

  // Load Firebase SDK
  var firebaseLoaded = 0;
  var firebaseTotal = 3;

  function onFirebasePartLoaded() {
    firebaseLoaded++;
    if (firebaseLoaded >= firebaseTotal) {
      initializeProtocol();
    }
  }

  loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js', function() {
    onFirebasePartLoaded();
    loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js', onFirebasePartLoaded);
    loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js', onFirebasePartLoaded);
  });

  // Load GA4
  loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID, function() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { send_page_view: true });
  });

  // ============================================================
  // PROOF DATA COLLECTOR
  // ============================================================
  // Collects and aggregates attention proof data for the dashboard

  var _proofData = {
    sessions: 0,
    totalHashes: 0,
    humanVerified: 0,
    botDetected: 0,
    avgFocusScore: 0,
    focusScores: [],
    tierDistribution: { deep: 0, active: 0, passive: 0, background: 0 },
    ga4EventsFired: 0,
    swsExclusiveCaptures: 0,
    verticalDemos: {},
    startedAt: Date.now()
  };

  function collectProofSnapshot() {
    if (typeof SWSAttention === 'undefined') return;

    var stats = SWSAttention.getStats();
    var confidence = SWSAttention.getHumanConfidence();

    _proofData.totalHashes = stats.totalHashes;
    _proofData.sessions++;

    if (confidence.composite >= 0.5) {
      _proofData.humanVerified++;
    } else if (confidence.composite < 0.25 && stats.totalHashes > 5) {
      _proofData.botDetected++;
    }

    _proofData.focusScores.push(stats.focusScore);
    if (_proofData.focusScores.length > 0) {
      _proofData.avgFocusScore = Math.round(
        _proofData.focusScores.reduce(function(a, b) { return a + b; }, 0) /
        _proofData.focusScores.length
      );
    }

    // Update tier distribution
    for (var tier in stats.tierDistribution) {
      _proofData.tierDistribution[tier] = (
        (_proofData.tierDistribution[tier] || 0) + (stats.tierDistribution[tier] || 0)
      );
    }

    // Store proof snapshot in localStorage for the dashboard to read
    try {
      localStorage.setItem('sws_proof_data', JSON.stringify(_proofData));
    } catch (e) {}

    // Also fire GA4 custom event with SWS-exclusive data
    if (typeof gtag === 'function') {
      gtag('event', 'sws_proof_snapshot', {
        sws_total_hashes: stats.totalHashes,
        sws_focus_score: stats.focusScore,
        sws_human_confidence: Math.round(confidence.composite * 100),
        sws_quality_tier: _getTierName(confidence.composite),
        sws_timing_signal: Math.round(confidence.timing * 100),
        sws_fitts_signal: Math.round(confidence.fitts * 100),
        sws_hicks_signal: Math.round(confidence.hicks * 100),
        sws_scroll_signal: Math.round(confidence.scroll * 100)
      });
      _proofData.ga4EventsFired++;
      _proofData.swsExclusiveCaptures++;
    }
  }

  function _getTierName(score) {
    if (score >= 0.75) return 'deep';
    if (score >= 0.50) return 'active';
    if (score >= 0.25) return 'passive';
    return 'background';
  }

  // ============================================================
  // INITIALIZE EVERYTHING
  // ============================================================

  function initializeProtocol() {
    // Initialize Firebase
    if (typeof firebase !== 'undefined' && (!firebase.apps || firebase.apps.length === 0)) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    // Initialize SWS Attention Protocol
    if (typeof SWSAttention !== 'undefined') {
      SWSAttention.init({
        gameId: GAME_ID,
        firebaseConfig: FIREBASE_CONFIG,
        debug: false,
        enableBehavioralAnalysis: true,
        onHashEarned: function(hash, eventType, tier) {
          _proofData.totalHashes++;

          // Fire matching GA4 event for every hash
          if (typeof gtag === 'function') {
            gtag('event', 'sws_hash_earned', {
              event_category: 'attention',
              sws_event_type: eventType,
              sws_quality_tier: tier,
              sws_hash_prefix: hash.substring(0, 8)
            });
            _proofData.ga4EventsFired++;
          }
        }
      });

      // Collect proof data every 30 seconds
      setInterval(collectProofSnapshot, 30000);

      // Collect on page unload
      window.addEventListener('beforeunload', function() {
        collectProofSnapshot();
        // Beacon the final proof data
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            'https://focus-grove-fffa8.firebaseio.com/proof_snapshots.json',
            JSON.stringify(_proofData)
          );
        }
      });

      // Initial collection after 5 seconds
      setTimeout(collectProofSnapshot, 5000);

      console.log('[SWS] Attention Protocol + GA4 Bridge active. Game ID:', GAME_ID);
    } else {
      console.warn('[SWS] SDK modules not loaded — ensure attention-protocol.js is included');
    }
  }

  // Expose proof data for the dashboard
  window.SWSProof = {
    getData: function() { return _proofData; },
    collectNow: collectProofSnapshot
  };

})();
