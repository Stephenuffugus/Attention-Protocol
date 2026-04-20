/**
 * SWS Attention Protocol — One-Tag Embed
 *
 * Drop this single script on ANY page to start generating
 * attention tokens with full behavioral analysis.
 *
 * Usage:
 *   <script src="https://sws-attention-proofs.web.app/embed.js"
 *           data-game-id="your_site_id"></script>
 *
 * Or with options:
 *   <script src="https://sws-attention-proofs.web.app/embed.js"
 *           data-game-id="your_site_id"
 *           data-debug="false"
 *           data-save="true"></script>
 *
 * What it does:
 *   1. Loads the SWS SDK (secure-config, attention-protocol, economy-engine)
 *   2. Initializes with behavioral analysis enabled
 *   3. Starts earning hashes from genuine attention events
 *   4. Optionally saves session data to the SWS proof Firestore
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function() {
  'use strict';

  // Read config from script tag attributes
  var scripts = document.getElementsByTagName('script');
  var thisScript = scripts[scripts.length - 1];
  var gameId = thisScript.getAttribute('data-game-id') || 'sws_embed_' + location.hostname;
  var debug = thisScript.getAttribute('data-debug') === 'true';
  var saveToFirestore = thisScript.getAttribute('data-save') !== 'false'; // default true
  var baseUrl = thisScript.src.replace(/embed\.js.*$/, '');

  // Track session
  var sessionId = 'embed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var sessionStart = Date.now();

  // Load SDK files in order
  var sdkFiles = [
    'sdk/secure-config.js',
    'sdk/attention-protocol.js',
    'sdk/economy-engine.js',
    'sdk/environmental-gate.js',
    'sdk/composition-integrity.js',
    'sdk/privacy-compliance.js',
    'sdk/honeypot-canary.js'
  ];
  var loaded = 0;
  var envResult = null; // populated once BotD check resolves

  function loadNext() {
    if (loaded >= sdkFiles.length) {
      onSDKReady();
      return;
    }
    var s = document.createElement('script');
    s.src = baseUrl + sdkFiles[loaded];
    s.onload = function() {
      loaded++;
      loadNext();
    };
    s.onerror = function() {
      console.warn('[SWS Embed] Failed to load: ' + sdkFiles[loaded]);
      loaded++;
      loadNext();
    };
    document.head.appendChild(s);
  }

  function onSDKReady() {
    if (typeof SWSAttention === 'undefined') {
      console.warn('[SWS Embed] SDK failed to load');
      return;
    }

    // Initialize
    SWSAttention.init({
      gameId: gameId,
      debug: debug,
      enableBehavioralAnalysis: true
    });

    if (debug) console.log('[SWS Embed] Initialized for ' + gameId);

    // Kick off the environmental gate (non-blocking, fail-to-unknown)
    if (typeof window.SWSEnvironmentalGate !== 'undefined') {
      window.SWSEnvironmentalGate.check().then(function(r) {
        envResult = r;
        if (debug) console.log('[SWS Embed] Environmental gate:', r);
      });
    }

    // Honeypot canary (Signal 22): inject an invisible prompt-injection
    // instruction into the page body. If an LLM summarizes or paraphrases
    // the content and the output is typed/pasted back here, the canary
    // word will surface in the detector at saveSession() time.
    window.__swsEmbedHoneypot = null;
    if (typeof window.SWSHoneypot !== 'undefined') {
      try {
        var hpCanary = window.SWSHoneypot.newCanary();
        var hpEl = document.body || document.documentElement;
        var hpInjection = window.SWSHoneypot.attachToElement(hpEl, hpCanary);
        window.__swsEmbedHoneypot = { canary: hpCanary, injection: hpInjection };
        if (debug) console.log('[SWS Embed] Honeypot canary armed:', hpCanary.canary_id);
      } catch (e) { /* non-critical */ }
    }

    // Composition Integrity (Signal 21): observe every text input on the page.
    // Covers forms, comment boxes, quiz answer fields — anywhere an LLM
    // paste would happen. Rescan on DOM mutations so we pick up late-inserted
    // inputs (SPA frameworks, infinite scroll, etc.).
    if (typeof window.SWSCompositionIntegrity !== 'undefined') {
      var scopeId = 'embed_' + gameId;
      var attachAll = function() {
        var nodes = document.querySelectorAll('input[type=text], input[type=email], input[type=search], input[type=url], textarea, [contenteditable=true]');
        window.SWSCompositionIntegrity.observe(nodes, { scopeId: scopeId });
      };
      attachAll();
      if (typeof MutationObserver !== 'undefined') {
        var mo = new MutationObserver(function() { attachAll(); });
        mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
      }
      // Expose for the saveSession path
      window.__swsCompositionScopeId = scopeId;
    }

    // Auto-earn for page visit
    SWSAttention.earn('page_visit', 0, 0, 'active');

    // Track scroll depth
    var maxScroll = 0;
    window.addEventListener('scroll', function() {
      var pct = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      if (pct > maxScroll) maxScroll = pct;
    }, { passive: true });

    // Periodic hash earning (every 60s of engagement)
    var earnInterval = setInterval(function() {
      var elapsed = Date.now() - sessionStart;
      var tier = document.hidden ? 'background' : 'active';
      SWSAttention.earn('engagement_tick', 60000, 0, tier);
      if (debug) {
        var c = SWSAttention.getHumanConfidence();
        console.log('[SWS Embed] Composite: ' + c.composite.toFixed(3) + ' | Hashes: ' + SWSAttention.getStats().totalHashes);
      }
    }, 60000);

    // Save session on page unload
    if (saveToFirestore) {
      window.addEventListener('beforeunload', function() {
        saveSession();
      });

      // Also save after 30 seconds of engagement
      setTimeout(function() {
        saveSession();
      }, 30000);
    }

    // Expose API for advanced usage
    window.SWSEmbed = {
      getScore: function() { return SWSAttention.getHumanConfidence(); },
      getStats: function() { return SWSAttention.getStats(); },
      getFocusScore: function() { return SWSAttention.getFocusScore(); },
      getSessionId: function() { return sessionId; },
      saveNow: function() { saveSession(); }
    };
  }

  function saveSession() {
    if (typeof SWSAttention === 'undefined') return;

    var c = SWSAttention.getHumanConfidence();
    var stats = SWSAttention.getStats();
    var elapsed = Math.round((Date.now() - sessionStart) / 1000);

    var data = {
      session_id: sessionId,
      game_id: gameId,
      timestamp: Date.now(),
      generated: new Date().toISOString(),
      duration_sec: elapsed,
      page_url: location.hostname + location.pathname,
      signals: {
        composite: c.composite,
        timing: c.timing,
        fitts: c.fitts,
        hicks: c.hicks,
        scroll: c.scroll,
        microPause: c.microPause,
        touch: c.touch
      },
      quality_tier: c.composite >= 0.7 ? 'deep' : c.composite >= 0.5 ? 'active' : c.composite >= 0.25 ? 'passive' : 'background',
      hashes_earned: stats.totalHashes,
      environmental: envResult || { loaded: false, error: 'not_yet_resolved', checked_at: new Date().toISOString() },
      composition_integrity: (typeof window.SWSCompositionIntegrity !== 'undefined' && window.__swsCompositionScopeId)
        ? window.SWSCompositionIntegrity.readSnapshot({ scopeId: window.__swsCompositionScopeId })
        : null,
      consent: (typeof window.SWSPrivacy !== 'undefined')
        ? window.SWSPrivacy.getReceiptAttestation({ policyUrl: baseUrl + 'privacy' })
        : null,
      honeypot: (function() {
        // Signal 22: scan every text input on the page for the canary word.
        // Detector runs at save time so we never store interim user text.
        if (typeof window.SWSHoneypot === 'undefined' || !window.__swsEmbedHoneypot) return null;
        var inputs = document.querySelectorAll('input[type=text],input[type=email],input[type=search],input[type=url],textarea,[contenteditable=true]');
        var combinedText = '';
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          combinedText += ' ' + (el.value || el.textContent || '');
        }
        var det = window.SWSHoneypot.detect(combinedText, window.__swsEmbedHoneypot.canary.word);
        return window.SWSHoneypot.buildReceiptBlock(
          window.__swsEmbedHoneypot.injection, det, window.__swsEmbedHoneypot.canary
        );
      })(),
      source: 'embed'
    };

    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      // Store locally for now — Firestore requires auth which we handle via the proof site
      try {
        var existing = JSON.parse(localStorage.getItem('sws_embed_sessions') || '[]');
        existing.push(data);
        if (existing.length > 50) existing.shift();
        localStorage.setItem('sws_embed_sessions', JSON.stringify(existing));
      } catch(e) {}
    }
  }

  // Start loading
  loadNext();
})();
