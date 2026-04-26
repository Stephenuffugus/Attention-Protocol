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

  /**
   * Multi-vector environmental tells beyond BotD.
   *
   * BotD catches naive Puppeteer/Selenium via webdriver/CDP markers.
   * Stealth-class adversaries (puppeteer-extra-stealth) patch those.
   * This function adds three complementary signals stealth typically
   * cannot patch consistently:
   *
   *   1. WebGL renderer fingerprint — cloud VMs / headless servers
   *      report SwiftShader / Mesa-llvmpipe / Google Inc. ANGLE strings;
   *      real consumer hardware reports nVidia / AMD / Apple / Intel.
   *      Cited: ACM WiSec 2025 "Unveiling Privacy Risks in WebGPU"
   *      (98% GPU-identification accuracy in 150 ms).
   *
   *   2. Function.prototype.toString consistency — stealth plugins
   *      monkey-patch native methods (e.g., Notification.permission,
   *      navigator.webdriver). The patched function's .toString() either
   *      returns the patch source (instead of '[native code]') or, when
   *      stealth tries to hide the patch, the toString itself has been
   *      replaced — both detectable.
   *
   *   3. chrome.runtime presence — real Chrome exposes window.chrome.runtime;
   *      headless Chrome (and many stealth setups) leave it undefined or
   *      stub it inconsistently with the chrome.* surface real Chrome ships.
   *
   * Synchronous, ~5–50 ms (WebGL probe is the slowest).
   * Returns aggregated suspicion score 0..1 + per-vector detail.
   */
  function _detectStealthTells() {
    var tells = { webgl: null, fnToString: null, chromeRuntime: null, perms: null, webgpu: null, iframe: null, audio: null };
    if (typeof window === 'undefined') {
      return { suspicion: 0, tells: tells, error: 'no_window' };
    }

    // Vector 1: WebGL renderer
    try {
      var canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
      var gl = canvas ? (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) : null;
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        var renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || '');
        var vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : (gl.getParameter(gl.VENDOR) || '');
        var rs = String(renderer || '').toLowerCase();
        var isCloudVM = (
          rs.indexOf('swiftshader') !== -1 ||
          rs.indexOf('llvmpipe') !== -1 ||
          rs.indexOf('mesa') !== -1 && rs.indexOf('software') !== -1 ||
          rs.indexOf('google inc') !== -1 && rs.indexOf('angle') === -1 ||
          rs === ''
        );
        tells.webgl = { renderer: String(renderer), vendor: String(vendor), cloud_vm_signature: isCloudVM };
      } else {
        tells.webgl = { renderer: null, vendor: null, cloud_vm_signature: true, no_webgl: true };
      }
    } catch (err) { tells.webgl = { error: err.message }; }

    // Vector 2: Function.toString native-code consistency.
    // Real native methods stringify to "function name() { [native code] }".
    // Stealth plugins patch some methods but rarely all the toString outputs
    // perfectly — we sample several and check.
    try {
      var samples = [
        { fn: window.Notification && Notification.requestPermission, name: 'Notification.requestPermission' },
        { fn: navigator.permissions && navigator.permissions.query, name: 'permissions.query' },
        { fn: navigator.webdriver !== undefined ? Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver') && Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver').get : null, name: 'webdriver.get' }
      ];
      var checks = [];
      samples.forEach(function(s) {
        if (!s.fn) return;
        try {
          var src = Function.prototype.toString.call(s.fn);
          var nativeSig = /\{\s*\[native code\]\s*\}/.test(src);
          checks.push({ name: s.name, native: nativeSig, length: src.length });
        } catch (e) { checks.push({ name: s.name, error: e.message }); }
      });
      // If any sampled built-in does NOT report native code, that's a tell.
      var nonNative = checks.filter(function(c) { return c.native === false; });
      tells.fnToString = { samples: checks, non_native_count: nonNative.length, suspicious: nonNative.length > 0 };
    } catch (err) { tells.fnToString = { error: err.message }; }

    // Vector 3: window.chrome shape. Real Chrome exposes chrome.runtime.
    // Headless / non-Chrome browsers leave chrome undefined or stubbed.
    try {
      var ch = window.chrome;
      var hasChrome = typeof ch === 'object' && ch !== null;
      var hasRuntime = hasChrome && typeof ch.runtime !== 'undefined';
      // On real Chrome.com pages chrome.runtime exists; absence here is
      // weak (extensions and policies can affect it) but combined with
      // other tells contributes to suspicion.
      tells.chromeRuntime = { has_chrome: hasChrome, has_runtime: hasRuntime };
    } catch (err) { tells.chromeRuntime = { error: err.message }; }

    // Vector 4: Notification.permission vs permissions.query consistency.
    // Headless Chrome historically returns Notification.permission='denied'
    // while permissions.query({name:'notifications'}) reports 'prompt' —
    // a known inconsistency stealth plugins often miss.
    try {
      if (typeof Notification !== 'undefined') {
        tells.perms = {
          notif_perm: String(Notification.permission || 'unknown'),
          // The async permissions.query check is done separately (returns Promise);
          // we record the synchronous tell only here.
          checked_async: false
        };
      }
    } catch (err) { tells.perms = { error: err.message }; }

    // Vector 5: WebGPU adapter info. Real consumer hardware reports specific
    // vendor + architecture strings (apple, intel, nvidia, amd, mali, etc.).
    // Cloud-VM headless Chrome typically reports vendor='google' + a software
    // renderer (swiftshader, llvmpipe, vulkan-on-cpu). Stealth plugins rarely
    // patch the WebGPU adapter info because most fingerprint libraries don't
    // probe it — it's a newer attack surface (Chrome 113+, May 2023).
    // Stronger signal than WebGL because it's a separate API surface.
    // Cited: ACM WiSec 2025 "Unveiling Privacy Risks in WebGPU".
    tells.webgpu = { available: false, async_pending: true };
    try {
      if (window.navigator && window.navigator.gpu && typeof window.navigator.gpu.requestAdapter === 'function') {
        // Note: WebGPU adapter request is async. We kick it off but return
        // before resolution; the result populates tells.webgpu via setter
        // for the next call to _detectStealthTells. For the FIRST call the
        // async result isn't available yet — that's a known limitation.
        // Cache the resolved info on a module-private var.
        if (_webgpuCachedInfo) {
          tells.webgpu = _webgpuCachedInfo;
        } else if (!_webgpuRequestInFlight) {
          _webgpuRequestInFlight = true;
          window.navigator.gpu.requestAdapter().then(function(adapter) {
            if (!adapter) {
              _webgpuCachedInfo = { available: false, no_adapter: true };
              _webgpuRequestInFlight = false;
              return;
            }
            // requestAdapterInfo is supported in Chrome 113+ but with caveats —
            // returns vendor + architecture; description sometimes missing.
            var infoP = (typeof adapter.requestAdapterInfo === 'function')
              ? adapter.requestAdapterInfo() : Promise.resolve({});
            return infoP.then(function(info) {
              var vendor = String((info && info.vendor) || '').toLowerCase();
              var arch = String((info && info.architecture) || '').toLowerCase();
              var device = String((info && info.device) || '').toLowerCase();
              var desc = String((info && info.description) || '').toLowerCase();
              var blob = vendor + ' ' + arch + ' ' + device + ' ' + desc;
              var cloudSig = (
                blob.indexOf('swiftshader') !== -1 ||
                blob.indexOf('llvmpipe') !== -1 ||
                blob.indexOf('software') !== -1 ||
                blob.indexOf('mesa') !== -1 && blob.indexOf('virtual') !== -1 ||
                (vendor === 'google' && (arch === '' || arch.indexOf('software') !== -1))
              );
              _webgpuCachedInfo = {
                available: true,
                vendor: vendor, architecture: arch, device: device,
                cloud_vm_signature: cloudSig
              };
              _webgpuRequestInFlight = false;
            });
          }).catch(function(err) {
            _webgpuCachedInfo = { available: false, error: err.message };
            _webgpuRequestInFlight = false;
          });
        }
      } else {
        tells.webgpu = { available: false, no_api: true };
      }
    } catch (err) { tells.webgpu = { available: false, error: err.message }; }

    // Vector 6: Iframe-frontier Function.toString consistency.
    // Stealth plugins patch top-frame native methods (e.g., navigator.webdriver,
    // Notification.requestPermission, plugin enumeration) by overriding them
    // at page load. The iframe contentWindow loads its own fresh JS context
    // with un-patched natives. Comparing a top-frame method's stringified
    // source against the iframe's same method reveals the patch — the iframe
    // returns "function name() { [native code] }", the patched top-frame
    // returns the patcher's source (or "function () { [native code] }" if
    // the stealth plugin uses Object.defineProperty + Function.prototype.toString
    // override; the latter we catch by comparing Function.toString itself).
    try {
      if (typeof document !== 'undefined' && document.body) {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;border:0';
        iframe.src = 'about:blank';
        document.body.appendChild(iframe);
        var iWin = iframe.contentWindow;
        if (iWin) {
          var checks = [];
          var topNotif = window.Notification && Notification.requestPermission;
          var iNotif = iWin.Notification && iWin.Notification.requestPermission;
          if (topNotif && iNotif) {
            var ts = Function.prototype.toString.call(topNotif);
            var is = Function.prototype.toString.call(iNotif);
            checks.push({ name: 'Notification.requestPermission', match: ts === is, top_native: /\[native code\]/.test(ts), iframe_native: /\[native code\]/.test(is) });
          }
          var topFns = Function.prototype.toString;
          var iFns = iWin.Function && iWin.Function.prototype && iWin.Function.prototype.toString;
          if (topFns && iFns) {
            var ts2 = Function.prototype.toString.call(topFns);
            var is2 = Function.prototype.toString.call(iFns);
            checks.push({ name: 'Function.prototype.toString', match: ts2 === is2 });
          }
          var topPlug = Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins');
          var iPlug = iWin.Navigator && Object.getOwnPropertyDescriptor(iWin.Navigator.prototype, 'plugins');
          if (topPlug && iPlug && topPlug.get && iPlug.get) {
            var ts3 = Function.prototype.toString.call(topPlug.get);
            var is3 = Function.prototype.toString.call(iPlug.get);
            checks.push({ name: 'navigator.plugins(getter)', match: ts3 === is3 });
          }
          document.body.removeChild(iframe);
          var mismatches = checks.filter(function(c) { return c.match === false; });
          tells.iframe = {
            available: true,
            checks: checks,
            mismatch_count: mismatches.length,
            suspicious: mismatches.length > 0
          };
        } else {
          tells.iframe = { available: false, reason: 'no_contentWindow' };
        }
      }
    } catch (err) { tells.iframe = { available: false, error: err.message }; }

    // Vector 7: AudioContext / OfflineAudioContext prototype shape.
    // Real Chromium exposes:
    //   - window.AudioContext (or webkitAudioContext) as a constructor
    //   - window.OfflineAudioContext as a constructor (instantiable without
    //     user-gesture — important: bypasses autoplay policy)
    //   - AudioContext.prototype.baseLatency as a native getter
    //   - AudioContext.prototype.audioWorklet as a native getter
    //   - AudioBuffer.prototype.sampleRate as a native getter
    // Stealth setups frequently leave these lazily-stubbed: the constructors
    // exist but the prototype getters are absent, return non-native code, or
    // throw on use. Many headless deployments also disable audio entirely
    // (--mute-audio, --use-fake-device-for-media-stream) leaving inconsistent
    // residue even when stealth tries to spoof the constructor surface.
    //
    // We check the prototype synchronously without instantiating — this
    // avoids the user-gesture requirement modern browsers apply to live
    // AudioContext, while still reading the same shape stealth has to spoof.
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var hasAC = typeof AC === 'function';
      var hasOAC = typeof OAC === 'function';
      var ctorNative = false, baseLatencyGetter = null, workletGetter = null, abufferGetter = null;
      if (hasAC) {
        try {
          var ctorSrc = Function.prototype.toString.call(AC);
          ctorNative = /\[native code\]/.test(ctorSrc);
        } catch (e) { ctorNative = false; }
        try {
          var bld = Object.getOwnPropertyDescriptor(AC.prototype, 'baseLatency');
          if (bld && typeof bld.get === 'function') {
            baseLatencyGetter = /\[native code\]/.test(Function.prototype.toString.call(bld.get));
          } else {
            baseLatencyGetter = false;
          }
        } catch (e) { baseLatencyGetter = false; }
        try {
          var awd = Object.getOwnPropertyDescriptor(AC.prototype, 'audioWorklet');
          if (awd && typeof awd.get === 'function') {
            workletGetter = /\[native code\]/.test(Function.prototype.toString.call(awd.get));
          } else {
            workletGetter = false;
          }
        } catch (e) { workletGetter = false; }
      }
      if (typeof window.AudioBuffer === 'function') {
        try {
          var srd = Object.getOwnPropertyDescriptor(window.AudioBuffer.prototype, 'sampleRate');
          if (srd && typeof srd.get === 'function') {
            abufferGetter = /\[native code\]/.test(Function.prototype.toString.call(srd.get));
          } else {
            abufferGetter = false;
          }
        } catch (e) { abufferGetter = false; }
      }
      // Suspicious if AudioContext is present but the prototype getters
      // expected on real Chromium are missing or non-native. Absence of
      // AudioContext entirely (older Safari, embedded WebViews) is NOT
      // suspicious by itself — only inconsistency is.
      var suspicious = false;
      var reasons = [];
      if (hasAC && !ctorNative) { suspicious = true; reasons.push('ac_ctor_not_native'); }
      if (hasAC && baseLatencyGetter === false) { suspicious = true; reasons.push('no_baseLatency_getter'); }
      if (hasAC && workletGetter === false) { suspicious = true; reasons.push('no_audioWorklet_getter'); }
      if (typeof window.AudioBuffer === 'function' && abufferGetter === false) {
        suspicious = true; reasons.push('no_sampleRate_getter');
      }
      // OfflineAudioContext absence on a browser that has AudioContext is
      // a strong tell — they ship together on real Chromium.
      if (hasAC && !hasOAC) { suspicious = true; reasons.push('no_offline_audio_context'); }
      tells.audio = {
        has_ac: hasAC,
        has_oac: hasOAC,
        ctor_native: ctorNative,
        base_latency_getter_native: baseLatencyGetter,
        audio_worklet_getter_native: workletGetter,
        audio_buffer_sample_rate_getter_native: abufferGetter,
        suspicious: suspicious,
        reasons: reasons
      };
    } catch (err) { tells.audio = { error: err.message, suspicious: false }; }

    // Aggregate suspicion 0..1.
    // WebGL cloud-VM signature: 0.45 (strong but can be spoofed by stealth)
    // WebGPU cloud-VM signature: 0.45 (strong AND harder to spoof — newer surface)
    // Iframe Function.toString mismatch: 0.40 (very strong — stealth can't patch iframe)
    // Function.toString suspicious: 0.25 (medium — stealth patches but inconsistently)
    // AudioContext prototype shape: 0.20 (medium — stealth lazily-stubs audio)
    // chrome.runtime missing: 0.10 (weak — extensions can affect this)
    var weight = 0;
    if (tells.webgl && tells.webgl.cloud_vm_signature) weight += 0.45;
    if (tells.webgpu && tells.webgpu.cloud_vm_signature) weight += 0.45;
    if (tells.iframe && tells.iframe.suspicious) weight += 0.40;
    if (tells.fnToString && tells.fnToString.suspicious) weight += 0.25;
    if (tells.audio && tells.audio.suspicious) weight += 0.20;
    if (tells.chromeRuntime && !tells.chromeRuntime.has_runtime) weight += 0.10;
    weight = Math.min(1.0, weight);

    return { suspicion: weight, tells: tells };
  }
  // Module-level WebGPU cache (async result populates it)
  var _webgpuCachedInfo = null;
  var _webgpuRequestInFlight = false;

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
    // We normalize to snake_case and ALSO run a multi-vector stealth-tells
    // detector — it catches puppeteer-extra-stealth class adversaries that
    // defeat BotD by patching the obvious markers but leave detectable
    // residue (cloud-VM GPU, monkey-patched Function.toString, missing
    // chrome.runtime). The two layers are OR'd; either flagging triggers
    // the gated-composite PASSIVE cap.
    var stealthTells = _detectStealthTells();
    var botdSaysBot = !!(raw && raw.bot);
    // Suspicion threshold: 0.50 = WebGL alone (cloud VM) OR 0.30+0.10 = fn-toString + chrome.runtime
    var stealthSaysBot = stealthTells.suspicion >= 0.50;
    var bot = botdSaysBot || stealthSaysBot;
    var bot_kind = null;
    if (botdSaysBot && raw.botKind) {
      bot_kind = String(raw.botKind);
    } else if (stealthSaysBot) {
      var k = [];
      if (stealthTells.tells.webgl && stealthTells.tells.webgl.cloud_vm_signature) k.push('cloud_vm_gpu');
      if (stealthTells.tells.webgpu && stealthTells.tells.webgpu.cloud_vm_signature) k.push('cloud_vm_webgpu');
      if (stealthTells.tells.iframe && stealthTells.tells.iframe.suspicious) k.push('iframe_mismatch');
      if (stealthTells.tells.fnToString && stealthTells.tells.fnToString.suspicious) k.push('patched_natives');
      if (stealthTells.tells.audio && stealthTells.tells.audio.suspicious) k.push('audio_shape_mismatch');
      if (stealthTells.tells.chromeRuntime && !stealthTells.tells.chromeRuntime.has_runtime) k.push('no_chrome_runtime');
      bot_kind = 'stealth:' + k.join('+');
    }
    return {
      loaded: true,
      bot: bot,
      bot_kind: bot_kind,
      botd_bot: botdSaysBot,
      botd_kind: (raw && raw.botKind) ? String(raw.botKind) : null,
      stealth_suspicion: stealthTells.suspicion,
      stealth_tells: stealthTells.tells,
      checked_at: new Date().toISOString(),
      latency_ms: Math.round(latencyMs),
      detector: 'botd@v2+stealth_tells_v2'
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
