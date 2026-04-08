/**
 * W3C Verifiable Credentials — Test Suite
 *
 * Tests the conversion of SWS attention receipts to W3C Verifiable Credentials
 * and selective disclosure presentations.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const { loadSDK, resetState } = require('./setup');

// Load SDK modules
beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

const VC = require('../src/sdk/verifiable-credentials');

// Sample receipt for testing
function makeReceipt() {
  return {
    receipt_id: 'rcpt_test_123',
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol',
    issuer: 'SWS Strategic Media LLC',
    generated_at: '2026-04-08T12:00:00.000Z',
    generated_timestamp: 1712577600000,
    subject_id: 'user_abc',
    application_id: 'test_app',
    content_id: 'training_module_101',
    content_name: 'Safety Training Module',
    engagement: {
      duration_ms: 300000,
      duration_formatted: '5 min 0 sec',
      focus_score: 78,
      quality_tier: 'deep',
      interaction_count: 45
    },
    human_verification: {
      composite_score: 0.82,
      timing_entropy: 0.75,
      fitts_compliance: 0.88,
      hicks_compliance: 0.91,
      scroll_saccade: 0.70,
      micro_pause: 0.65,
      touch_variance: 0.80,
      verdict: 'verified_human_deep_engagement'
    },
    proof: {
      hash_count: 5,
      hash_ids: ['h1', 'h2', 'h3', 'h4', 'h5'],
      algorithm: 'SHA-256',
      receipt_hash: 'abc123def456'
    },
    privacy: {
      no_content_recorded: true,
      no_pii_collected: true,
      no_urls_tracked: true,
      data_categories: ['duration', 'interaction_count', 'quality_tier', 'behavioral_metrics'],
      coppa_compliant: true,
      scif_eligible: true
    }
  };
}

describe('Verifiable Credentials Module', () => {

  describe('Credential Generation', () => {
    test('converts receipt to W3C VC format', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred['@context']).toContain('https://www.w3.org/ns/credentials/v2');
      expect(cred.type).toContain('VerifiableCredential');
      expect(cred.type).toContain('AttentionVerificationCredential');
      expect(cred.issuer.id).toBe(VC.ISSUER_DID);
      expect(cred.credentialSubject).toBeDefined();
    });

    test('includes engagement data', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred.credentialSubject.engagement.durationMs).toBe(300000);
      expect(cred.credentialSubject.engagement.focusScore).toBe(78);
      expect(cred.credentialSubject.engagement.qualityTier).toBe('deep');
    });

    test('includes human verification verdict', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred.credentialSubject.humanVerification.verdict).toBe('verified_human_deep_engagement');
      expect(cred.credentialSubject.humanVerification.compositeScore).toBe(0.82);
    });

    test('includes behavioral signals by default', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred.credentialSubject.humanVerification.signals).toBeDefined();
      expect(cred.credentialSubject.humanVerification.signals.hicksCompliance).toBe(0.91);
      expect(cred.credentialSubject.humanVerification.signals.fittsCompliance).toBe(0.88);
    });

    test('excludes signals when requested', () => {
      const cred = VC.fromReceipt(makeReceipt(), { includeSignals: false });
      expect(cred.credentialSubject.humanVerification.signals).toBeUndefined();
      expect(cred.credentialSubject.humanVerification.verdict).toBe('verified_human_deep_engagement');
    });

    test('includes privacy evidence', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred.evidence).toHaveLength(1);
      expect(cred.evidence[0].type).toBe('PrivacyAttestation');
      expect(cred.evidence[0].noPiiCollected).toBe(true);
    });

    test('includes proof with receipt hash', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred.proof.type).toBe('Sha256ReceiptIntegrity2026');
      expect(cred.proof.receiptHash).toBe('abc123def456');
    });

    test('generates subject DID from userId', () => {
      const cred = VC.fromReceipt(makeReceipt());
      expect(cred.credentialSubject.id).toMatch(/^did:sws:user:/);
    });

    test('accepts custom subject DID', () => {
      const cred = VC.fromReceipt(makeReceipt(), { subjectDid: 'did:example:custom' });
      expect(cred.credentialSubject.id).toBe('did:example:custom');
    });
  });

  describe('Completion Credentials', () => {
    test('adds completion data and type when present', () => {
      const receipt = makeReceipt();
      receipt.completion = {
        type: 'training_module',
        started_at: '2026-04-08T11:55:00.000Z',
        completed_at: '2026-04-08T12:00:00.000Z',
        minimum_required_minutes: 5,
        actual_minutes: 5.0,
        met_minimum: true,
        engagement_sufficient: true,
        human_verified: true
      };

      const cred = VC.fromReceipt(receipt);
      expect(cred.type).toContain('TrainingCompletionCredential');
      expect(cred.credentialSubject.completion).toBeDefined();
      expect(cred.credentialSubject.completion.metMinimum).toBe(true);
      expect(cred.credentialSubject.completion.humanVerified).toBe(true);
    });
  });

  describe('Selective Disclosure', () => {
    test('creates presentation with only verdict', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const pres = VC.createPresentation(cred, ['verdict']);

      expect(pres.type).toContain('VerifiablePresentation');
      const subject = pres.verifiableCredential[0].credentialSubject;
      expect(subject.humanVerification.verdict).toBe('verified_human_deep_engagement');
      expect(subject.engagement).toBeUndefined();
      expect(subject.humanVerification.signals).toBeUndefined();
    });

    test('creates presentation with verdict + tier', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const pres = VC.createPresentation(cred, ['verdict', 'tier']);

      const subject = pres.verifiableCredential[0].credentialSubject;
      expect(subject.humanVerification.verdict).toBe('verified_human_deep_engagement');
      expect(subject.engagement.qualityTier).toBe('deep');
      expect(subject.engagement.focusScore).toBeUndefined();
    });

    test('creates presentation with all fields', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const pres = VC.createPresentation(cred, ['verdict', 'tier', 'duration', 'focusScore', 'signals', 'privacy']);

      const subject = pres.verifiableCredential[0].credentialSubject;
      expect(subject.humanVerification.verdict).toBeDefined();
      expect(subject.engagement.qualityTier).toBeDefined();
      expect(subject.engagement.durationFormatted).toBeDefined();
      expect(subject.engagement.focusScore).toBe(78);
      expect(subject.humanVerification.signals.hicksCompliance).toBe(0.91);
    });

    test('holder ID matches credential subject', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const pres = VC.createPresentation(cred, ['verdict']);
      expect(pres.holder).toBe(cred.credentialSubject.id);
    });
  });

  describe('Verification', () => {
    test('validates well-formed credential', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const result = VC.verify(cred);
      expect(result.valid).toBe(true);
      expect(result.issuer).toBe(VC.ISSUER_NAME);
    });

    test('validates presentation', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const pres = VC.createPresentation(cred, ['verdict']);
      const result = VC.verify(pres);
      expect(result.valid).toBe(true);
    });

    test('rejects credential with missing context', () => {
      const cred = VC.fromReceipt(makeReceipt());
      cred['@context'] = [];
      const result = VC.verify(cred);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('missing_vc_context');
    });

    test('rejects credential with missing proof', () => {
      const cred = VC.fromReceipt(makeReceipt());
      cred.proof = null;
      const result = VC.verify(cred);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('missing_proof');
    });

    test('flags unknown issuer', () => {
      const cred = VC.fromReceipt(makeReceipt());
      cred.issuer.id = 'did:web:evil.com';
      const result = VC.verify(cred);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/unknown_issuer/);
    });
  });

  describe('Export Formats', () => {
    test('exports as JSON-LD string', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const jsonLd = VC.toJsonLd(cred);
      expect(typeof jsonLd).toBe('string');
      const parsed = JSON.parse(jsonLd);
      expect(parsed['@context']).toBeDefined();
    });

    test('exports as JWT string', () => {
      const cred = VC.fromReceipt(makeReceipt());
      const jwt = VC.toJwt(cred);
      expect(typeof jwt).toBe('string');
      const parts = jwt.split('.');
      expect(parts.length).toBe(3); // header.payload.signature
    });
  });
});
