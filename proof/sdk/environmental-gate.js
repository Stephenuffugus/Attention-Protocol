/**
 * SWS Attention Protocol — Environmental Gate (BotD wrapper)
 *
 * A NON-BEHAVIORAL layer. Runs once per session, before any behavioral
 * measurement, and fingerprints the execution environment for telltale
 * signs of browser automation (Puppeteer, Playwright, Selenium, webdriver
 * flags, spoofed user agents, missing-but-expected APIs).
 *
 * Kept strictly separate from the behavioral composite. Receipts surface
 * TWO signals:
 *   - human_verification.composite_score    (15-signal behavioral)
 *   - environmental.bot                      (this module, BotD v2)
 *
 * A reviewer, regulator, or downstream integrator can combine them as
 * they see fit. We do not collapse them into one number.
 *
 * Failure mode: FAIL TO UNKNOWN. If BotD fails to load or throws, the
 * receipt records `environmental: { loaded: false, error: '<reason>' }`.
 * Behavioral scoring continues uninterrupted.
 *
 * Library: @fingerprintjs/botd v2 (MIT). Bundled locally at
 * proof/vendor/botd.esm.js so we have no runtime 3rd-party dependency.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  var CACHED = null;          // The most recent {bot, botKind, ...} result.
  var IN_FLIGHT = null;       // Promise, if check() is currently running.

  // Capture this script's absolute URL at load time so we can derive an
  // absolute URL to ../vendor/botd.esm.js. `new Function('import(u)')`
  // creates an anonymous CORS context whose base URL is about:blank, so a
  // relative specifier there will fail. An absolute URL works from anywhere.
  var BOTD_URL = (function() {
    try {
      var d = (typeof document !== 'undefined') ? document : null;
      if (!d) return '../vendor/botd.esm.js';
      var me = d.currentScript;
      if (!me) {
        var scripts = d.getElementsByTagName('script');
        me = scripts[scripts.length - 1];
      }
      if (me && me.src) {
        // Strip filename+query from /sdk/environmental-gate.js?v=X → /sdk
        var dir = me.src.replace(/\/[^\/]*$/, '');
        return dir + '/../vendor/botd.esm.js';
      }
    } catch (e) { /* fall through */ }
    return '../vendor/botd.esm.js';
  })();

  /**
   * Run the environmental check (lazy, cached after first run).
   *
   * @param {Object} [opts]
   * @param {string} [opts.botdUrl] - override the BotD ESM URL.
   * @param {number} [opts.timeoutMs=4000] - how long to wait before giving up.
   * @returns {Promise<EnvResult>}
   *
   * EnvResult shape:
   *   { loaded: true,  bot: boolean, bot_kind: string|null, checked_at: ISOstring, latency_ms: number }
   *   { loaded: false, error: string, checked_at: ISOstring }
   */
  function check(opts) {
    opts = opts || {};
    if (CACHED) return Promise.resolve(CACHED);
    if (IN_FLIGHT) return IN_FLIGHT;

    var url = opts.botdUrl || BOTD_URL;
    var timeout = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 4000;
    var startedAt = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    IN_FLIGHT = _runWithTimeout(url, timeout, startedAt)
      .then(function(result) {
        CACHED = result;
        IN_FLIGHT = null;
        return result;
      })
      .catch(function(err) {
        CACHED = {
          loaded: false,
          error: (err && err.message) ? err.message : String(err || 'unknown_error'),
          checked_at: new Date().toISOString()
        };
        IN_FLIGHT = null;
        return CACHED;
      });

    return IN_FLIGHT;
  }

  function _runWithTimeout(url, timeoutMs, startedAt) {
    var timer;
    var timeoutPromise = new Promise(function(_, reject) {
      timer = setTimeout(function() { reject(new Error('botd_timeout_' + timeoutMs + 'ms')); }, timeoutMs);
    });
    var workPromise = _loadAndDetect(url, startedAt);
    return Promise.race([workPromise, timeoutPromise])
      .finally(function() { if (timer) clearTimeout(timer); });
  }

  function _loadAndDetect(url, startedAt) {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('no_window_environment'));
    }
    // Dynamic import of the local BotD ESM module.
    // Wrapped in a function string eval to avoid static-analyzer rewrites
    // and to keep this file importable in environments that don't support
    // dynamic import (tests mock the path).
    var dynamicImport;
    try {
      dynamicImport = new Function('u', 'return import(u)');
    } catch (e) {
      return Promise.reject(new Error('dynamic_import_unsupported'));
    }
    return dynamicImport(url).then(function(mod) {
      if (!mod || typeof mod.load !== 'function') {
        throw new Error('botd_api_unexpected');
      }
      return mod.load().then(function(botd) {
        if (!botd || typeof botd.detect !== 'function') {
          throw new Error('botd_instance_missing_detect');
        }
        var result = botd.detect();
        var now = (typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now();
        return _normalizeResult(result, now - startedAt);
      });
    });
  }

  function _normalizeResult(raw, latencyMs) {
    // BotD v2 returns either:
    //   { bot: true,  botKind: 'headless_chrome' | 'selenium' | ... }
    //   { bot: false }
    // We normalize to snake_case and add loaded/checked_at.
    return {
      loaded: true,
      bot: !!(raw && raw.bot),
      bot_kind: (raw && raw.botKind) ? String(raw.botKind) : null,
      checked_at: new Date().toISOString(),
      latency_ms: Math.round(latencyMs),
      detector: 'botd@v2'
    };
  }

  /**
   * Read the cached result without triggering a run.
   * @returns {EnvResult|null}
   */
  function getCachedResult() {
    return CACHED;
  }

  /**
   * Reset cached state. Intended for tests only.
   */
  function _resetForTests() {
    CACHED = null;
    IN_FLIGHT = null;
  }

  // ============================================================
  // EXPORT
  // ============================================================

  var EnvironmentalGate = {
    check: check,
    getCachedResult: getCachedResult,
    _resetForTests: _resetForTests,
    _normalizeResult: _normalizeResult  // exposed for unit tests
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnvironmentalGate;
  } else if (typeof root !== 'undefined') {
    root.SWSEnvironmentalGate = EnvironmentalGate;
  }

})(typeof window !== 'undefined' ? window : this);
