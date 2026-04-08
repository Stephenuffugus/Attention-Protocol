/**
 * WebAuthn Device Binding — Test Suite
 *
 * Tests the device attestation system that binds attention receipts
 * to hardware-verified devices.
 *
 * Note: WebAuthn requires a browser environment with authenticator support.
 * These tests verify the software fallback path and API structure.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const { loadSDK, resetState } = require('./setup');

// Mock screen and Intl for Node environment
global.screen = { width: 1920, height: 1080, colorDepth: 24 };
global.Intl = global.Intl || {};
if (!Intl.DateTimeFormat) {
  Intl.DateTimeFormat = function() { return { resolvedOptions: function() { return { timeZone: 'America/New_York' }; } }; };
}
global.btoa = global.btoa || function(s) { return Buffer.from(s, 'binary').toString('base64'); };
global.atob = global.atob || function(s) { return Buffer.from(s, 'base64').toString('binary'); };

beforeEach(() => {
  resetState();
  loadSDK('../src/sdk/device-binding.js');
});

describe('Device Binding Module', () => {

  describe('Initialization', () => {
    test('initializes and reports availability', () => {
      const status = SWSDeviceBinding.init();
      expect(status).toBeDefined();
      expect(typeof status.available).toBe('boolean');
      expect(typeof status.enrolled).toBe('boolean');
    });

    test('reports not enrolled on fresh init', () => {
      const status = SWSDeviceBinding.init();
      expect(status.enrolled).toBe(false);
    });

    test('getStatus returns structured status', () => {
      SWSDeviceBinding.init();
      const status = SWSDeviceBinding.getStatus();
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('enrolled');
      expect(status).toHaveProperty('type');
    });
  });

  describe('Software Fallback', () => {
    test('sign produces software attestation when WebAuthn unavailable', async () => {
      SWSDeviceBinding.init();
      const attestation = await SWSDeviceBinding.sign('test_receipt_hash_abc123');
      expect(attestation).toBeDefined();
      expect(attestation.type).toBe('software');
      expect(attestation.device_bound).toBe(false);
      expect(attestation.fingerprint_hash).toBeDefined();
      expect(attestation.timestamp).toBeGreaterThan(0);
    });

    test('software attestation includes device signals', async () => {
      SWSDeviceBinding.init();
      const attestation = await SWSDeviceBinding.sign('hash_123');
      expect(attestation.signals).toBeDefined();
      expect(attestation.signals.screen).toBeDefined();
      expect(attestation.signals.timezone).toBeDefined();
    });

    test('same device produces same fingerprint', async () => {
      SWSDeviceBinding.init();
      const a1 = await SWSDeviceBinding.sign('hash_1');
      const a2 = await SWSDeviceBinding.sign('hash_2');
      expect(a1.fingerprint_hash).toBe(a2.fingerprint_hash);
    });
  });

  describe('Verification', () => {
    test('verifies software attestation from same device', async () => {
      SWSDeviceBinding.init();
      const attestation = await SWSDeviceBinding.sign('hash_test');
      const result = SWSDeviceBinding.verify(attestation);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('software');
      expect(result.same_device).toBe(true);
    });

    test('returns invalid for null attestation', () => {
      SWSDeviceBinding.init();
      const result = SWSDeviceBinding.verify(null);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('no_device_attestation');
    });

    test('handles webauthn attestation structure', () => {
      SWSDeviceBinding.init();
      const result = SWSDeviceBinding.verify({
        type: 'webauthn',
        credential_id: 'test_cred',
        signature: 'test_sig',
        device_bound: true
      });
      expect(result.valid).toBe(true);
      expect(result.type).toBe('hardware');
      expect(result.device_bound).toBe(true);
    });

    test('enroll returns fallback when WebAuthn unavailable', async () => {
      SWSDeviceBinding.init();
      const result = await SWSDeviceBinding.enroll('test_user');
      expect(result.enrolled).toBe(false);
      expect(result.reason).toBe('webauthn_not_available');
      expect(result.fallback).toBe('device_fingerprint');
    });
  });
});
