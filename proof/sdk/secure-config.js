/**
 * SWS Attention Protocol — Secure Configuration System
 * Loads trade secret calibration values from a secure source
 * instead of hardcoding them in client-side JavaScript.
 *
 * TRADE SECRET VALUES (thresholds, weights, multipliers)
 * must NEVER appear in public source code or client bundles.
 * They are loaded at runtime from a server endpoint or
 * Firebase Remote Config.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window) {
  'use strict';

  // ============================================================
  // DEFAULT CONFIG (non-secret generic values for development)
  // These are deliberately GENERIC and not calibrated.
  // Production deployments MUST load calibrated values.
  // ============================================================

  var DEV_DEFAULTS = {
    // Behavioral pattern weights (composite score formula)
    weights: {
      timing_entropy: 0.25,
      fitts_law: 0.20,
      hicks_law: 0.10,
      scroll_saccade: 0.15,
      micro_pause: 0.15,
      touch_variance: 0.15
    },

    // Tier multipliers
    multipliers: {
      deep: 2.0,
      active: 1.0,
      passive: 0.5,
      background: 0.25
    },

    // Focus score weights
    focus_weights: {
      deep: 1.0,
      active: 0.7,
      passive: 0.3,
      background: 0.1
    },

    // Tier boundary thresholds (human confidence score → max tier)
    tier_boundaries: {
      deep_min: 0.75,
      active_min: 0.50,
      passive_min: 0.25
    },

    // Behavioral pattern thresholds
    thresholds: {
      timing_cv_bot_cutoff: 0.25,
      timing_cv_human_min: 0.4,
      fitts_human_min_r: 0.3,
      fitts_bot_cutoff_r: 0.15,
      scroll_min_fixations: 2,
      micro_pause_min_ms: 200,
      micro_pause_max_ms: 2000,
      touch_variance_human_min: 0.5,
      afk_threshold_ms: 1800000, // 30 min
      idle_drip_interval_ms: 300000 // 5 min
    },

    // Economy caps
    caps: {
      idle_drip_max_per_hour: 12,
      ambient_max_per_hour: 20,
      tab_return_max_per_event: 8,
      notification_tap_max_per_day: 3,
      fitness_max_per_day: 10,
      extension_max_per_hour: 6,
      extension_max_per_day: 36,
      partner_max_per_day: 1
    },

    // SDK revenue split
    revenue_split: {
      user: 0.70,
      developer: 0.29,
      protocol: 0.01
    }
  };

  // ============================================================
  // CONFIG STATE
  // ============================================================

  var _config = null;
  var _configSource = 'none';
  var _configLoaded = false;
  var _loadCallbacks = [];

  // ============================================================
  // CONFIG LOADING
  // ============================================================

  /**
   * Load configuration from a secure source.
   * Priority: Server endpoint > Firebase Remote Config > Dev defaults
   */
  function loadConfig(options, callback) {
    options = options || {};

    // Option 1: Server endpoint
    if (options.endpoint) {
      _loadFromEndpoint(options.endpoint, function(config) {
        if (config) {
          _applyConfig(config, 'server');
          if (callback) callback(_config);
        } else {
          _tryFirebaseRemoteConfig(options, callback);
        }
      });
      return;
    }

    // Option 2: Firebase Remote Config
    _tryFirebaseRemoteConfig(options, callback);
  }

  function _loadFromEndpoint(endpoint, callback) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', endpoint, true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = 5000;

      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            var config = JSON.parse(xhr.responseText);
            callback(config);
          } catch (e) {
            callback(null);
          }
        } else {
          callback(null);
        }
      };

      xhr.onerror = function() { callback(null); };
      xhr.ontimeout = function() { callback(null); };
      xhr.send();
    } catch (e) {
      callback(null);
    }
  }

  function _tryFirebaseRemoteConfig(options, callback) {
    if (typeof firebase !== 'undefined' && firebase.remoteConfig) {
      try {
        var rc = firebase.remoteConfig();
        rc.settings = { minimumFetchIntervalMillis: 3600000 }; // 1 hour cache

        rc.fetchAndActivate().then(function() {
          var configStr = rc.getString('attention_protocol_config');
          if (configStr) {
            try {
              var config = JSON.parse(configStr);
              _applyConfig(config, 'firebase_remote_config');
              if (callback) callback(_config);
              return;
            } catch (e) { /* fall through */ }
          }
          _applyConfig(DEV_DEFAULTS, 'dev_defaults');
          if (callback) callback(_config);
        }).catch(function() {
          _applyConfig(DEV_DEFAULTS, 'dev_defaults');
          if (callback) callback(_config);
        });
        return;
      } catch (e) { /* fall through */ }
    }

    // Fallback to dev defaults
    _applyConfig(DEV_DEFAULTS, 'dev_defaults');
    if (callback) callback(_config);
  }

  function _applyConfig(config, source) {
    // Deep merge with defaults to ensure no missing keys
    _config = _deepMerge(DEV_DEFAULTS, config);
    _configSource = source;
    _configLoaded = true;

    // Notify waiting callbacks
    _loadCallbacks.forEach(function(cb) { cb(_config); });
    _loadCallbacks = [];
  }

  function _deepMerge(target, source) {
    var result = {};
    for (var key in target) {
      if (target.hasOwnProperty(key)) {
        if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
          result[key] = _deepMerge(target[key], (source && source[key]) || {});
        } else {
          result[key] = (source && source.hasOwnProperty(key)) ? source[key] : target[key];
        }
      }
    }
    return result;
  }

  // ============================================================
  // CONFIG ACCESS
  // ============================================================

  /**
   * Get the current configuration.
   * Returns dev defaults if no config has been loaded yet.
   */
  function getConfig() {
    return _config || DEV_DEFAULTS;
  }

  /**
   * Get a specific config value by dot-separated path.
   * e.g., get('thresholds.timing_cv_bot_cutoff')
   */
  function get(path) {
    var config = getConfig();
    var keys = path.split('.');
    var value = config;
    for (var i = 0; i < keys.length; i++) {
      if (value === null || value === undefined) return undefined;
      value = value[keys[i]];
    }
    return value;
  }

  /**
   * Register a callback to be called when config is loaded.
   */
  function onConfigLoaded(callback) {
    if (_configLoaded) {
      callback(_config);
    } else {
      _loadCallbacks.push(callback);
    }
  }

  /**
   * Get config source info for diagnostics.
   */
  function getConfigInfo() {
    return {
      loaded: _configLoaded,
      source: _configSource,
      isProduction: _configSource !== 'dev_defaults',
      timestamp: Date.now()
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSConfig = {
    loadConfig: loadConfig,
    getConfig: getConfig,
    get: get,
    onConfigLoaded: onConfigLoaded,
    getConfigInfo: getConfigInfo,
    DEV_DEFAULTS: DEV_DEFAULTS
  };

})(window);
