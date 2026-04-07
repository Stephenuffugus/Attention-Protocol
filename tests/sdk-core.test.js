/**
 * SWS Attention Protocol — Core SDK Tests
 * Tests that the protocol modules load, initialize, and produce correct outputs.
 * Run with: npx jest tests/sdk-core.test.js
 */

const { loadSDK, resetState } = require('./setup');

// Load SDK modules in dependency order
loadSDK('../src/sdk/secure-config.js');
loadSDK('../src/sdk/attention-protocol.js');
loadSDK('../src/sdk/economy-engine.js');
loadSDK('../src/sdk/privacy-compliance.js');
loadSDK('../src/sdk/attention-receipts.js');
loadSDK('../src/sdk/share-to-earn.js');
loadSDK('../src/sdk/movement-fitness.js');

// ============================================================
// Core SDK
// ============================================================

describe('Core SDK — Module Loading', () => {
  test('SWSAttention exists on window', () => {
    expect(typeof window.SWSAttention).toBe('object');
  });

  test('has all required public methods', () => {
    const required = [
      'init', 'earn', 'spend', 'getBalance', 'getHashes', 'getStats',
      'getFocusScore', 'getHumanConfidence', 'startAmbient', 'stopAmbient',
      'recordDecision', 'recordContentRender', 'getSessionId', 'getSyncStatus'
    ];
    required.forEach(method => {
      expect(typeof SWSAttention[method]).toBe('function');
    });
  });

  test('version is 1.0.0', () => {
    expect(SWSAttention.version).toBe('1.0.0');
  });

  test('patent reference is SWS-PROV-001', () => {
    expect(SWSAttention.patent).toBe('SWS-PROV-001');
  });

  test('entity is SWS Strategic Media LLC', () => {
    expect(SWSAttention.entity).toBe('SWS Strategic Media LLC');
  });
});

describe('Core SDK — Initialization', () => {
  beforeAll(() => {
    resetState();
    SWSAttention.init({ gameId: 'test_suite', debug: false, enableBehavioralAnalysis: true });
  });

  test('init() creates a session ID', () => {
    const sid = SWSAttention.getSessionId();
    expect(sid.length).toBe(32); // 16 bytes hex-encoded
    expect(/^[0-9a-f]{32}$/.test(sid)).toBe(true);
  });

  test('getStats() returns valid structure', () => {
    const stats = SWSAttention.getStats();
    expect(typeof stats.totalHashes).toBe('number');
    expect(typeof stats.balance).toBe('number');
    expect(typeof stats.focusScore).toBe('number');
    expect(typeof stats.tierDistribution).toBe('object');
    expect(typeof stats.sessionDurationMs).toBe('number');
    expect(stats.tierDistribution).toHaveProperty('deep');
    expect(stats.tierDistribution).toHaveProperty('active');
    expect(stats.tierDistribution).toHaveProperty('passive');
    expect(stats.tierDistribution).toHaveProperty('background');
  });

  test('getBalance() returns a number', () => {
    expect(typeof SWSAttention.getBalance()).toBe('number');
  });

  test('getSyncStatus() returns valid structure', () => {
    const sync = SWSAttention.getSyncStatus();
    expect(typeof sync.total).toBe('number');
    expect(typeof sync.synced).toBe('number');
    expect(typeof sync.queued).toBe('number');
    expect(typeof sync.firebaseAvailable).toBe('boolean');
  });

  test('earn() generates a hash and increases balance', (done) => {
    const beforeBalance = SWSAttention.getBalance();
    SWSAttention.earn('test_event', 5000, 10, 'active');
    // Hash generation is async (SHA-256), give it a moment
    setTimeout(() => {
      const afterBalance = SWSAttention.getBalance();
      expect(afterBalance).toBeGreaterThan(beforeBalance);
      const hashes = SWSAttention.getHashes();
      const testHash = hashes.find(h => h.event_type === 'test_event');
      expect(testHash).toBeDefined();
      expect(testHash.hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex chars
      expect(testHash.quality_tier).toBe('active');
      done();
    }, 100);
  });
});

// ============================================================
// Behavioral Analysis — Human Confidence
// ============================================================

describe('Behavioral Analysis — Human Confidence', () => {
  test('getHumanConfidence() returns composite and all 6 signals', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(typeof c.composite).toBe('number');
    expect(c.composite).toBeGreaterThanOrEqual(0);
    expect(c.composite).toBeLessThanOrEqual(1);
    expect(typeof c.timing).toBe('number');
    expect(typeof c.fitts).toBe('number');
    expect(typeof c.hicks).toBe('number');
    expect(typeof c.scroll).toBe('number');
    expect(typeof c.microPause).toBe('number');
    expect(typeof c.touch).toBe('number');
  });

  test('getFocusScore() returns 0-100', () => {
    const score = SWSAttention.getFocusScore();
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('recordDecision() accepts parameters without error', () => {
    expect(() => {
      SWSAttention.recordDecision(4, 1500);
      SWSAttention.recordDecision(8, 2200);
    }).not.toThrow();
  });

  test('recordContentRender() accepts complexity levels', () => {
    expect(() => {
      SWSAttention.recordContentRender('simple');
      SWSAttention.recordContentRender('moderate');
      SWSAttention.recordContentRender('complex');
    }).not.toThrow();
  });
});

// ============================================================
// Economy Engine
// ============================================================

describe('Economy Engine', () => {
  test('SWSEconomy exists on window', () => {
    expect(typeof window.SWSEconomy).toBe('object');
  });

  test('checkCap() returns valid structure', () => {
    const result = SWSEconomy.checkCap('idle_drip');
    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.reason).toBe('string');
  });

  test('getMultiplier() returns correct tier values', () => {
    expect(SWSEconomy.getMultiplier('deep')).toBe(2.0);
    expect(SWSEconomy.getMultiplier('active')).toBe(1.0);
    expect(SWSEconomy.getMultiplier('passive')).toBe(0.5);
    expect(SWSEconomy.getMultiplier('background')).toBe(0.25);
  });

  test('applyMultiplier() doubles for deep focus', () => {
    // Deep = 2.0x, so 1 hash always becomes 2
    expect(SWSEconomy.applyMultiplier(1, 'deep')).toBe(2);
    expect(SWSEconomy.applyMultiplier(5, 'deep')).toBe(10);
  });

  test('applyMultiplier() halves for passive (probabilistic)', () => {
    // Passive = 0.5x. Run many trials, average should be ~0.5
    let total = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      total += SWSEconomy.applyMultiplier(1, 'passive');
    }
    const avg = total / trials;
    // Should be roughly 0.5 (within statistical tolerance)
    expect(avg).toBeGreaterThan(0.35);
    expect(avg).toBeLessThan(0.65);
  });

  test('DAILY_CAPS defined for all core event types', () => {
    const caps = SWSEconomy.DAILY_CAPS;
    expect(caps.idle_drip).toBeDefined();
    expect(caps.tab_return).toBeDefined();
    expect(caps.notification_tap).toBeDefined();
    expect(caps.fitness_import).toBeDefined();
    expect(caps.extension_browse).toBeDefined();
    expect(caps.notification_tap.maxPerDay).toBe(3);
    expect(caps.extension_browse.maxPerDay).toBe(36);
    expect(caps.extension_browse.maxPerHour).toBe(6);
  });

  test('validateSpend() rejects insufficient balance', () => {
    const result = SWSEconomy.validateSpend(999999, 'test');
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('insufficient_balance');
  });

  test('validateSpend() rejects zero/negative amounts', () => {
    expect(SWSEconomy.validateSpend(0, 'test').approved).toBe(false);
    expect(SWSEconomy.validateSpend(-5, 'test').approved).toBe(false);
  });

  test('getEconomyStats() returns structured data', () => {
    const stats = SWSEconomy.getEconomyStats();
    expect(typeof stats.date).toBe('string');
    expect(typeof stats.caps).toBe('object');
    expect(stats.caps.idle_drip).toBeDefined();
  });

  test('daily cap enforcement blocks after limit', () => {
    // notification_tap has maxPerDay: 3
    // Record 3 earnings
    SWSEconomy.recordEarning('notification_tap', 3);
    const check = SWSEconomy.checkCap('notification_tap');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('daily_cap_reached');
  });
});

// ============================================================
// Privacy Compliance
// ============================================================

describe('Privacy Compliance', () => {
  test('SWSPrivacy exists on window', () => {
    expect(typeof window.SWSPrivacy).toBe('object');
  });

  test('getConsent() returns all consent types', () => {
    const consent = SWSPrivacy.getConsent();
    expect(typeof consent.attention_tracking).toBe('boolean');
    expect(typeof consent.behavioral_analysis).toBe('boolean');
    expect(typeof consent.cloud_sync).toBe('boolean');
    expect(typeof consent.fitness_bridge).toBe('boolean');
    expect(typeof consent.browser_extension).toBe('boolean');
    expect(typeof consent.push_notifications).toBe('boolean');
  });

  test('setConsent() persists and returns updated consent', () => {
    SWSPrivacy.setConsent({ attention_tracking: true, behavioral_analysis: true });
    const consent = SWSPrivacy.getConsent();
    expect(consent.attention_tracking).toBe(true);
    expect(consent.behavioral_analysis).toBe(true);
    expect(consent.timestamp).not.toBeNull();
  });

  test('revokeAllConsent() clears all consent', () => {
    SWSPrivacy.setConsent({ attention_tracking: true, cloud_sync: true });
    SWSPrivacy.revokeAllConsent();
    const consent = SWSPrivacy.getConsent();
    expect(consent.attention_tracking).toBe(false);
    expect(consent.behavioral_analysis).toBe(false);
    expect(consent.cloud_sync).toBe(false);
  });

  test('verifyCOPPA() passes on clean payload', () => {
    const result = SWSPrivacy.verifyCOPPA({
      event_type: 'idle_drip',
      timestamp: Date.now(),
      session_id: 'abc123',
      duration_ms: 5000,
      interaction_count: 10,
      quality_tier: 'active',
      game_id: 'test',
      user_uid: 'anon_123',
      nonce: 'xyz'
    });
    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('verifyCOPPA() rejects payload with email', () => {
    const result = SWSPrivacy.verifyCOPPA({
      event_type: 'test',
      email: 'user@example.com'
    });
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('verifyCOPPA() rejects email in user_uid', () => {
    const result = SWSPrivacy.verifyCOPPA({
      event_type: 'test',
      user_uid: 'user@email.com'
    });
    expect(result.compliant).toBe(false);
  });

  test('verifyCOPPA() rejects URL in string fields', () => {
    const result = SWSPrivacy.verifyCOPPA({
      event_type: 'test',
      user_uid: 'https://evil.com/track'
    });
    expect(result.compliant).toBe(false);
  });

  test('exportAllData() returns structured data', (done) => {
    SWSPrivacy.exportAllData(function(data) {
      expect(data.protocol).toBe('SWS Proof of Attention Protocol');
      expect(data.entity).toBe('SWS Strategic Media LLC');
      expect(Array.isArray(data.local_hashes)).toBe(true);
      expect(Array.isArray(data.data_categories.collected)).toBe(true);
      expect(Array.isArray(data.data_categories.never_collected)).toBe(true);
      expect(data.data_categories.never_collected.length).toBeGreaterThanOrEqual(8);
      done();
    });
  });

  test('buildConsentUI() returns HTML with consent banner', () => {
    const html = SWSPrivacy.buildConsentUI();
    expect(typeof html).toBe('string');
    expect(html).toContain('sws-consent-banner');
    expect(html).toContain('SWS Attention Protocol');
  });
});

// ============================================================
// Cryptographic Receipts
// ============================================================

describe('Cryptographic Receipts', () => {
  test('SWSReceipts exists on window', () => {
    expect(typeof window.SWSReceipts).toBe('object');
  });

  test('generateReceipt() produces valid structure', () => {
    const receipt = SWSReceipts.generateReceipt({
      userId: 'test_user',
      contentId: 'module_101',
      contentName: 'Fall Prevention Training',
      durationMs: 480000,
      focusScore: 72,
      qualityTier: 'active',
      interactionCount: 45,
      gameId: 'test_suite'
    });
    expect(receipt.receipt_id).toMatch(/^rcpt_/);
    expect(receipt.receipt_version).toBe('1.0');
    expect(receipt.issuer).toBe('SWS Strategic Media LLC');
    expect(receipt.engagement.focus_score).toBe(72);
    expect(receipt.engagement.quality_tier).toBe('active');
    expect(receipt.privacy.no_content_recorded).toBe(true);
    expect(receipt.privacy.coppa_compliant).toBe(true);
    expect(receipt.privacy.scif_eligible).toBe(true);
  });

  test('generateReceipt() receipt_hash resolves asynchronously', (done) => {
    SWSReceipts.generateReceiptAsync({
      userId: 'async_test',
      contentId: 'test_001',
      durationMs: 60000,
      focusScore: 80,
      qualityTier: 'deep',
      interactionCount: 30,
      gameId: 'test_suite'
    }, function(receipt) {
      expect(receipt.proof.receipt_hash).toBeDefined();
      expect(receipt.proof.receipt_hash).not.toMatch(/^pending_/);
      expect(receipt.proof.receipt_hash).toMatch(/^[0-9a-f]{64}$/);
      done();
    });
  });

  test('generateCompletionReceipt() includes compliance summary', () => {
    const receipt = SWSReceipts.generateCompletionReceipt({
      contentId: 'training_001',
      contentName: 'OSHA Safety',
      completionType: 'training_module',
      durationMs: 1800000,  // 30 min
      focusScore: 68,
      qualityTier: 'active',
      interactionCount: 120,
      minimumMinutes: 30,
      startedAt: Date.now() - 1800000
    });
    expect(receipt.completion).toBeDefined();
    expect(receipt.compliance_summary).toBeDefined();
    expect(receipt.completion.type).toBe('training_module');
    expect(receipt.completion.met_minimum).toBe(true);
    expect(receipt.compliance_summary.suitable_for_audit).toBe(true);
    expect(receipt.compliance_summary.training_genuine).toBe(true);
  });

  test('completion receipt flags low engagement', () => {
    const receipt = SWSReceipts.generateCompletionReceipt({
      contentId: 'training_002',
      durationMs: 300000,   // 5 min (below 30 min minimum)
      focusScore: 20,       // low engagement
      qualityTier: 'background',
      interactionCount: 2,
      minimumMinutes: 30
    });
    expect(receipt.completion.met_minimum).toBe(false);
    expect(receipt.completion.engagement_sufficient).toBe(false);
    expect(receipt.compliance_summary.training_genuine).toBe(false);
  });

  test('getReceipts() returns stored receipts', () => {
    const receipts = SWSReceipts.getReceipts();
    expect(Array.isArray(receipts)).toBe(true);
    expect(receipts.length).toBeGreaterThanOrEqual(2);
  });

  test('generateComplianceReport() produces valid report', () => {
    const report = SWSReceipts.generateComplianceReport();
    expect(report.report_type).toBe('SWS Attention Compliance Report');
    expect(report.issuer).toBe('SWS Strategic Media LLC');
    expect(typeof report.summary.total_receipts).toBe('number');
    expect(typeof report.summary.avg_focus_score).toBe('number');
    expect(report.summary.total_receipts).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Secure Config
// ============================================================

describe('Secure Config', () => {
  test('SWSConfig exists on window', () => {
    expect(typeof window.SWSConfig).toBe('object');
  });

  test('getConfig() returns default behavioral weights', () => {
    const config = SWSConfig.getConfig();
    expect(config.weights.timing_entropy).toBe(0.25);
    expect(config.weights.fitts_law).toBe(0.20);
    expect(config.multipliers.deep).toBe(2.0);
    expect(config.revenue_split.user).toBe(0.70);
    expect(config.revenue_split.developer).toBe(0.29);
    expect(config.revenue_split.protocol).toBe(0.01);
  });

  test('get() supports dot notation', () => {
    expect(SWSConfig.get('thresholds.timing_cv_bot_cutoff')).toBe(0.25);
    expect(SWSConfig.get('caps.extension_max_per_day')).toBe(36);
  });

  test('revenue split sums to 100%', () => {
    const split = SWSConfig.get('revenue_split');
    const total = split.user + split.developer + split.protocol;
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
  });
});

// ============================================================
// Share-to-Earn
// ============================================================

describe('Share-to-Earn', () => {
  test('SWSShare exists on window', () => {
    expect(typeof window.SWSShare).toBe('object');
  });

  test('createShareLink() generates tracked link', () => {
    const result = SWSShare.createShareLink('https://example.com/content', 'achievement');
    expect(result.shareUrl).toContain('sws_share=');
    expect(result.shareId).toMatch(/^shr_/);
    expect(result.contentType).toBe('achievement');
  });
});

// ============================================================
// Movement & Fitness
// ============================================================

describe('Movement & Fitness', () => {
  test('SWSMovement exists on window', () => {
    expect(typeof window.SWSMovement).toBe('object');
  });

  test('getMovementStats() returns valid structure', () => {
    const stats = SWSMovement.getMovementStats();
    expect(typeof stats.gps).toBe('object');
    expect(typeof stats.accelerometer).toBe('object');
    expect(typeof stats.fitness).toBe('object');
    expect(typeof stats.totalSteps).toBe('number');
  });

  test('importFitnessSteps() enforces daily cap of 10', () => {
    const result = SWSMovement.importFitnessSteps('google_fit', 15000, '2026-03-27');
    expect(result.success).toBe(true);
    expect(result.hashesEarned).toBeLessThanOrEqual(10);
  });
});
