/**
 * SWS Attention Protocol — Node.js Test Environment Setup
 * Mocks browser globals so SDK modules can load in Node.js
 */

const { webcrypto } = require('crypto');

// --- localStorage mock ---
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

// --- document mock ---
const listeners = {};
const documentMock = {
  hidden: false,
  readyState: 'complete',
  addEventListener: (type, fn) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  },
  removeEventListener: () => {},
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    href: '', download: '', click: () => {}, style: {},
    appendChild: () => {}, removeChild: () => {},
    innerHTML: ''
  }),
  getElementsByTagName: () => [{ getAttribute: () => null }],
  getElementById: () => null,
  body: { appendChild: () => {}, removeChild: () => {} }
};

// --- window mock using Proxy to auto-expose properties to global ---
const windowBase = {
  crypto: {
    getRandomValues: (arr) => webcrypto.getRandomValues(arr),
    subtle: webcrypto.subtle
  },
  scrollY: 0,
  addEventListener: () => {},
  removeEventListener: () => {},
  navigator: { wakeLock: undefined },
  localStorage: localStorageMock,
  document: documentMock
};

// Proxy: when SDK sets window.SWSAttention = {...}, also set global.SWSAttention
const windowMock = new Proxy(windowBase, {
  set(target, prop, value) {
    target[prop] = value;
    // Auto-expose SDK modules to global scope
    if (typeof prop === 'string' && prop.startsWith('SWS')) {
      global[prop] = value;
    }
    return true;
  },
  get(target, prop) {
    if (prop in target) return target[prop];
    return undefined;
  }
});

// Apply to global
global.window = windowMock;
global.document = documentMock;
global.localStorage = localStorageMock;
global.navigator = windowBase.navigator;
global.TextEncoder = TextEncoder;
global.Uint8Array = Uint8Array;

// URL mock for blob downloads
global.URL = { createObjectURL: () => 'blob://mock', revokeObjectURL: () => {} };
global.Blob = class Blob { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };

/**
 * Helper: Load an SDK module into the global scope.
 * Uses vm.runInThisContext to bypass Jest's module caching.
 * Modules use (function(window){...})(window) pattern so they
 * assign to global.window which is our Proxy.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadSDK(modulePath) {
  const resolved = path.resolve(__dirname, modulePath);
  const code = fs.readFileSync(resolved, 'utf-8');
  const script = new vm.Script(code, { filename: resolved });
  script.runInNewContext(global, { timeout: 5000 });
}

/**
 * Helper: Reset all localStorage state between tests
 */
function resetState() {
  localStorageMock.clear();
  // Reset initialized state by reloading modules
}

module.exports = { loadSDK, resetState, localStorageMock, store };
