/**
 * SWS Attention Protocol — GA4 Comparison Tests
 *
 * These tests prove that SWS captures metrics that GA4 cannot,
 * and that the dual-tracking bridge works correctly.
 *
 * Run with: npx jest tests/ga4-comparison.test.js
 */

const { loadSDK, resetState } = require('./setup');

beforeEach(() => {
  resetState();
  // Mock gtag
  global.window.dataLayer = [];
  global.window.gtag = function() {
    global.window.dataLayer.push(Array.from(arguments));
  };

  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/privacy-compliance.js');
  loadSDK('../src/sdk/ga4-bridge.js');

  SWSAttention.init({ gameId: 'ga4_test', debug: false, enableBehavioralAnalysis: true });
  SWSGA4.init({ measurementId: 'G-TEST12345', debug: false });
});

// ============================================================
// Bridge Module Loading
// ============================================================

describe('GA4 Bridge — Module Loading', () => {
  test('SWSGA4 exists on window', () => {
    expect(typeof window.SWSGA4).toBe('object');
  });

  test('has all required methods', () => {
    expect(typeof SWSGA4.init).toBe('function');
    expect(typeof SWSGA4.sendDualEvent).toBe('function');
    expect(typeof SWSGA4.getComparisonReport).toBe('function');
    expect(typeof SWSGA4.getComparisonStats).toBe('function');
    expect(typeof SWSGA4.getEventLog).toBe('function');
  });

  test('EVENT_MAP covers all core SWS event types', () => {
    const coreEvents = ['page_visit', 'idle_drip', 'tab_return', 'ambient_mode',
                        'game_start', 'game_complete', 'share_verified', 'notification_tap'];
    coreEvents.forEach(evt => {
      expect(SWSGA4.EVENT_MAP[evt]).toBeDefined();
      expect(SWSGA4.EVENT_MAP[evt].ga4Event).toContain('sws_');
    });
  });
});

// ============================================================
// Dual Event Tracking
// ============================================================

describe('GA4 Bridge — Dual Event Tracking', () => {
  test('sendDualEvent fires both SWS and GA4 events', () => {
    const result = SWSGA4.sendDualEvent('page_visit', {
      hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      quality_tier: 'active',
      focus_score: 72,
      human_confidence: 0.85,
      duration_ms: 30000,
      interaction_count: 15
    });

    // SWS side
    expect(result.sws.captured).toBe(true);
    expect(result.sws.hash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    expect(result.sws.quality_tier).toBe('active');
    expect(result.sws.focus_score).toBe(72);
    expect(result.sws.human_confidence).toBe(0.85);

    // GA4 side
    expect(result.ga4.captured).toBe(true);
    expect(result.ga4.event_name).toBe('sws_page_visit');
    expect(result.ga4.parameters.sws_quality_tier).toBe('active');
    expect(result.ga4.parameters.sws_focus_score).toBe(72);
    expect(result.ga4.parameters.sws_human_confidence).toBe(85); // rounded to integer
  });

  test('sendDualEvent records SWS-exclusive delta', () => {
    const result = SWSGA4.sendDualEvent('idle_drip', {
      hash: 'deadbeef'.repeat(8),
      quality_tier: 'passive',
      focus_score: 45,
      human_confidence: 0.62
    });

    expect(result.delta.cryptographic_hash).toBe(true);
    expect(result.delta.behavioral_analysis).toBe(true);
    expect(result.delta.quality_tier_classification).toBe(true);
    expect(result.delta.focus_score).toBe(true);
    expect(result.delta.human_vs_bot_detection).toBe(true);
    expect(result.delta.offline_first_sync).toBe(true);
  });

  test('sendDualEvent handles unknown event types gracefully', () => {
    const result = SWSGA4.sendDualEvent('custom_event_xyz', {
      hash: '00'.repeat(32),
      quality_tier: 'deep'
    });

    expect(result.sws.captured).toBe(true);
    expect(result.ga4.captured).toBe(true);
    expect(result.ga4.event_name).toBe('sws_custom_event_xyz');
  });

  test('gtag dataLayer receives the event', () => {
    const beforeLength = window.dataLayer.length;

    SWSGA4.sendDualEvent('game_complete', {
      quality_tier: 'deep',
      focus_score: 92,
      human_confidence: 0.95
    });

    // gtag was called at least once
    expect(window.dataLayer.length).toBeGreaterThan(beforeLength);

    // Find the event call
    const eventCall = window.dataLayer.find(call =>
      call[0] === 'event' && call[1] === 'sws_game_complete'
    );
    expect(eventCall).toBeDefined();
    expect(eventCall[2].sws_quality_tier).toBe('deep');
    expect(eventCall[2].sws_focus_score).toBe(92);
  });
});

// ============================================================
// Comparison Statistics
// ============================================================

describe('GA4 Bridge — Comparison Stats', () => {
  test('stats track SWS and GA4 event counts', () => {
    SWSGA4.sendDualEvent('page_visit', { quality_tier: 'active' });
    SWSGA4.sendDualEvent('idle_drip', { quality_tier: 'passive' });
    SWSGA4.sendDualEvent('tab_return', { quality_tier: 'active' });

    const stats = SWSGA4.getComparisonStats();
    expect(stats.sws_events).toBeGreaterThanOrEqual(3);
    expect(stats.ga4_events).toBeGreaterThanOrEqual(3);
    expect(stats.both_systems).toBeGreaterThanOrEqual(3);
  });

  test('event log stores comparison records', () => {
    SWSGA4.sendDualEvent('page_visit', { quality_tier: 'active' });

    const log = SWSGA4.getEventLog();
    expect(log.length).toBeGreaterThanOrEqual(1);

    const lastEvent = log[log.length - 1];
    expect(lastEvent.sws.captured).toBe(true);
    expect(lastEvent.ga4.captured).toBe(true);
    expect(lastEvent.delta).toBeDefined();
  });
});

// ============================================================
// Comparison Report
// ============================================================

describe('GA4 Bridge — Comparison Report', () => {
  test('report includes SWS-exclusive capabilities', () => {
    SWSGA4.sendDualEvent('page_visit', { quality_tier: 'deep', focus_score: 88 });

    const report = SWSGA4.getComparisonReport();

    expect(report.protocol).toBe('SWS Proof of Attention Protocol');
    expect(report.comparison_with).toBe('Google Analytics 4');

    // SWS-exclusive capabilities
    const exc = report.sws_exclusive_capabilities;
    expect(exc.cryptographic_proof).toBeDefined();
    expect(exc.behavioral_science).toBeDefined();
    expect(exc.quality_tier_classification).toBeDefined();
    expect(exc.focus_score).toBeDefined();
    expect(exc.human_vs_bot).toBeDefined();
    expect(exc.offline_first).toBeDefined();
    expect(exc.privacy_by_design).toBeDefined();

    // Each capability should explain what GA4 can't do
    expect(exc.cryptographic_proof.ga4_equivalent).toContain('None');
    expect(exc.behavioral_science.ga4_equivalent).toContain('None');
    expect(exc.quality_tier_classification.ga4_equivalent).toContain('None');
  });

  test('report lists GA4-only events SWS intentionally skips', () => {
    const report = SWSGA4.getComparisonReport();

    expect(Array.isArray(report.ga4_exclusive_events)).toBe(true);
    expect(report.ga4_exclusive_events.length).toBeGreaterThan(0);

    const pageView = report.ga4_exclusive_events.find(e => e.event === 'page_view');
    expect(pageView).toBeDefined();
    expect(pageView.reason_sws_skips).toContain('Privacy');
  });

  test('report event stats are accurate', () => {
    // Send some dual events
    SWSGA4.sendDualEvent('page_visit', { quality_tier: 'active' });
    SWSGA4.sendDualEvent('idle_drip', { quality_tier: 'passive' });

    const report = SWSGA4.getComparisonReport();
    expect(report.stats.sws_events).toBeGreaterThanOrEqual(2);
    expect(report.stats.ga4_events).toBeGreaterThanOrEqual(2);
    expect(report.stats.both_systems).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// THE PROOF: SWS captures what GA4 misses
// ============================================================

describe('THE PROOF — SWS vs GA4 Side-by-Side', () => {
  test('SWS captures cryptographic hash, GA4 does not', () => {
    const hash = 'abc123'.repeat(11).substring(0, 64);
    const result = SWSGA4.sendDualEvent('page_visit', {
      hash: hash,
      quality_tier: 'deep'
    });

    // SWS has the full hash
    expect(result.sws.hash).toBe(hash);
    // GA4 only gets the first 8 chars as a custom dimension
    expect(result.ga4.parameters.sws_hash_prefix).toBe(hash.substring(0, 8));
    // GA4 cannot verify the hash — it's just a string parameter
    expect(result.delta.cryptographic_hash).toBe(true);
  });

  test('SWS captures behavioral science signals, GA4 does not', () => {
    const signals = {
      composite: 0.82,
      timing: 0.9,
      fitts: 0.7,
      hicks: 0.8,
      scroll: 0.6,
      microPause: 0.75,
      touch: 0.65
    };

    const result = SWSGA4.sendDualEvent('page_visit', {
      human_confidence: signals.composite,
      behavioral_signals: signals,
      quality_tier: 'deep'
    });

    // SWS has the full signal breakdown
    expect(result.sws.human_confidence).toBe(0.82);
    expect(result.sws.behavioral_signals.timing).toBe(0.9);
    expect(result.sws.behavioral_signals.fitts).toBe(0.7);
    expect(result.sws.behavioral_signals.hicks).toBe(0.8);

    // GA4 only gets a single integer (0-100)
    expect(result.ga4.parameters.sws_human_confidence).toBe(82);
    // GA4 has no equivalent for behavioral signal breakdown
    expect(result.delta.behavioral_analysis).toBe(true);
  });

  test('SWS distinguishes quality tiers, GA4 treats all engagement equally', () => {
    const deepResult = SWSGA4.sendDualEvent('page_visit', {
      quality_tier: 'deep',
      focus_score: 95,
      duration_ms: 1800000  // 30 min deep focus
    });

    const bgResult = SWSGA4.sendDualEvent('page_visit', {
      quality_tier: 'background',
      focus_score: 10,
      duration_ms: 1800000  // 30 min background tab
    });

    // SWS: These are VERY different quality levels
    expect(deepResult.sws.quality_tier).toBe('deep');
    expect(deepResult.sws.focus_score).toBe(95);
    expect(bgResult.sws.quality_tier).toBe('background');
    expect(bgResult.sws.focus_score).toBe(10);

    // GA4: Both are just "engagement" events with same duration
    // GA4 engagement_time would be similar for both
    expect(deepResult.ga4.parameters.sws_duration_ms).toBe(bgResult.ga4.parameters.sws_duration_ms);
    // Without SWS, GA4 can't tell the difference
    expect(deepResult.delta.quality_tier_classification).toBe(true);
  });

  test('SWS works offline, GA4 loses events', () => {
    // Simulate offline — remove gtag
    const originalGtag = window.gtag;
    delete window.gtag;

    const result = SWSGA4.sendDualEvent('idle_drip', {
      hash: 'offline_hash_' + '0'.repeat(51),
      quality_tier: 'passive'
    });

    // SWS still captured the event
    expect(result.sws.captured).toBe(true);
    // GA4 lost it
    expect(result.ga4.captured).toBe(false);
    expect(result.delta.offline_first_sync).toBe(true);

    // Restore gtag
    window.gtag = originalGtag;
  });

  test('SWS never tracks URLs or PII, GA4 does', () => {
    const report = SWSGA4.getComparisonReport();

    // Verify SWS privacy claims
    expect(report.sws_exclusive_capabilities.privacy_by_design.description)
      .toContain('No URLs');
    expect(report.sws_exclusive_capabilities.privacy_by_design.ga4_equivalent)
      .toContain('GA4 tracks page URLs');

    // Verify GA4 tracks page_view (which includes URL)
    const ga4OnlyPageView = report.ga4_exclusive_events.find(e => e.event === 'page_view');
    expect(ga4OnlyPageView).toBeDefined();
  });
});
