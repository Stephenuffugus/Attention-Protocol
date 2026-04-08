#!/usr/bin/env node
/**
 * SWS Attention Protocol — Proof Runner
 *
 * Executes all vertical proof simulations and outputs structured results.
 * Each vertical produces a JSON proof document with:
 *   - Signal breakdowns (all 6 behavioral signals)
 *   - Human vs bot comparisons with score gaps
 *   - Verdicts and confidence levels
 *   - Timestamps and metadata for the proof catalog
 *
 * Usage:
 *   node proof/run-proofs.js                  → runs all verticals, writes to proof/results/
 *   node proof/run-proofs.js --vertical=bot   → runs only bot-detection
 *   node proof/run-proofs.js --json           → outputs single JSON to stdout
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load the test environment (mocks browser globals)
require(path.resolve(__dirname, '../tests/setup'));

// Load SDK modules
const { loadSDK, resetState } = require(path.resolve(__dirname, '../tests/setup'));
loadSDK('../src/sdk/secure-config.js');
loadSDK('../src/sdk/attention-protocol.js');
loadSDK('../src/sdk/economy-engine.js');

// Extended modules export singletons with .init(), .reset(), etc.
const ContentTracker = require(path.resolve(__dirname, '../src/sdk/content-attention-tracker.js'));
const VideoTracker = require(path.resolve(__dirname, '../src/sdk/video-attention-tracker.js'));
const BaselineProfiler = require(path.resolve(__dirname, '../src/sdk/baseline-profiler.js'));
const TemporalAnalyzer = require(path.resolve(__dirname, '../src/sdk/temporal-session-analyzer.js'));
const IntegrityValidator = require(path.resolve(__dirname, '../src/sdk/session-integrity-validator.js'));
const VerticalProfiles = require(path.resolve(__dirname, '../src/sdk/vertical-scoring-profiles.js'));

// Helper: generate scroll velocity data
function makeScrollVelocities(avgVelocity, count) {
  const vels = [];
  let y = 0, t = 0;
  for (let i = 0; i < count; i++) {
    const dt = 100 + Math.random() * 50;
    const dy = avgVelocity * dt;
    t += dt; y += dy;
    vels.push({ y, t });
  }
  return vels;
}

// Helper: generate temporal session events
// Uses current real timestamps so _buildWindows works with Date.now()
function generateSession(windowCount, opts) {
  opts = opts || {};
  const windowMs = 300000;
  const sessionStart = Date.now() - (windowCount * windowMs) - 1000;
  const events = [];
  for (let w = 0; w < windowCount; w++) {
    const windowStart = sessionStart + (w * windowMs);
    const progress = windowCount > 1 ? w / (windowCount - 1) : 0;
    const rtMean = (opts.rtStart || 300) + progress * ((opts.rtEnd || 300) - (opts.rtStart || 300));
    const precMean = (opts.precStart || 5) + progress * ((opts.precEnd || 5) - (opts.precStart || 5));
    const jitterMean = (opts.jitterStart || 1) + progress * ((opts.jitterEnd || 1) - (opts.jitterStart || 1));
    const rateMultiplier = opts.rateDecline ? (1 - progress * opts.rateDecline) : 1;
    const adjustedCount = Math.max(5, Math.round((opts.eventsPerWindow || 20) * rateMultiplier));
    for (let i = 0; i < adjustedCount; i++) {
      const ts = windowStart + (windowMs / adjustedCount) * i;
      const noise = () => (Math.random() - 0.5) * 0.3;
      events.push({ type: 'reaction_time', timestamp: ts, value: rtMean * (1 + noise()) });
      events.push({ type: 'click_precision', timestamp: ts + 1, value: precMean * (1 + noise()) });
      events.push({ type: 'mouse_jitter', timestamp: ts + 2, value: jitterMean * (1 + noise()) });
      events.push({ type: 'scroll', timestamp: ts + 3, value: 1 });
    }
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  return { events, sessionStart };
}

// Helper: feed baseline profiler
function feedBaseline(profiler, opts) {
  opts = opts || {};
  const count = opts.count || 25;
  profiler.startBaseline();
  for (let i = 0; i < count; i++) {
    profiler.recordReactionTime((opts.reactionTimeMean || 300) + (Math.random() - 0.5) * (opts.reactionTimeVariance || 50) * 2);
    profiler.recordClickPrecision((opts.precisionMean || 5) + (Math.random() - 0.5) * (opts.precisionVariance || 2) * 2);
    profiler.recordScroll();
    profiler.recordMousePosition(100 + i * 5, 200 + i * 2);
  }
  for (let i = 0; i < Math.min(count, 15); i++) {
    profiler.recordDecisionSpeed((opts.decisionMean || 500) + (Math.random() - 0.5) * 200);
  }
}

// ============================================================
// SIMULATION ENGINE
// ============================================================

function runSimulation(profile) {
  resetState();
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');

  SWSAttention.init({ gameId: 'proof_runner', debug: false, enableBehavioralAnalysis: true });

  if (profile.decisions) {
    profile.decisions.forEach(d => SWSAttention.recordDecision(d.options, d.responseTime));
  }
  if (profile.renders) {
    profile.renders.forEach(r => SWSAttention.recordContentRender(r.complexity));
  }
  if (profile.events) {
    profile.events.forEach(e => SWSAttention.earn(e.type, e.duration, e.interactions, e.tier));
  }

  return {
    name: profile.name,
    description: profile.description,
    confidence: SWSAttention.getHumanConfidence(),
    focusScore: SWSAttention.getFocusScore(),
    stats: SWSAttention.getStats()
  };
}

// ============================================================
// BOT PROFILES
// ============================================================

const BOT_PROFILES = [
  {
    name: 'Naive Bot',
    description: 'Constant 50ms clicks, zero variance, ignores option count',
    decisions: [
      { options: 2, responseTime: 50 }, { options: 2, responseTime: 50 },
      { options: 4, responseTime: 50 }, { options: 4, responseTime: 50 },
      { options: 8, responseTime: 50 }, { options: 8, responseTime: 50 },
      { options: 16, responseTime: 50 }, { options: 16, responseTime: 50 },
      { options: 2, responseTime: 50 }, { options: 4, responseTime: 50 },
    ],
    renders: [{ complexity: 'simple' }, { complexity: 'moderate' }, { complexity: 'complex' }],
    events: [
      { type: 'page_visit', duration: 100, interactions: 1, tier: 'active' },
      { type: 'survey_answer', duration: 50, interactions: 1, tier: 'active' },
      { type: 'survey_answer', duration: 50, interactions: 1, tier: 'active' },
    ]
  },
  {
    name: 'Jittered Bot',
    description: 'Jittered 100-300ms timing, uncorrelated with option count',
    decisions: [
      { options: 2, responseTime: 230 }, { options: 2, responseTime: 150 },
      { options: 4, responseTime: 180 }, { options: 4, responseTime: 270 },
      { options: 8, responseTime: 120 }, { options: 8, responseTime: 200 },
      { options: 16, responseTime: 160 }, { options: 16, responseTime: 250 },
      { options: 2, responseTime: 190 }, { options: 4, responseTime: 140 },
    ],
    renders: [{ complexity: 'simple' }, { complexity: 'moderate' }, { complexity: 'complex' }],
    events: [
      { type: 'page_visit', duration: 500, interactions: 1, tier: 'active' },
      { type: 'survey_answer', duration: 200, interactions: 1, tier: 'active' },
      { type: 'survey_answer', duration: 180, interactions: 1, tier: 'active' },
    ]
  },
  {
    name: 'Selenium Bot',
    description: 'Browser automation — immediate clicks after render, scripted sequence',
    decisions: [
      { options: 4, responseTime: 30 }, { options: 4, responseTime: 45 },
      { options: 4, responseTime: 25 }, { options: 4, responseTime: 55 },
      { options: 4, responseTime: 35 }, { options: 4, responseTime: 40 },
    ],
    renders: [{ complexity: 'moderate' }, { complexity: 'moderate' }, { complexity: 'moderate' }],
    events: [
      { type: 'page_visit', duration: 2000, interactions: 0, tier: 'background' },
      { type: 'survey_answer', duration: 30, interactions: 1, tier: 'active' },
      { type: 'survey_answer', duration: 45, interactions: 1, tier: 'active' },
    ]
  },
  {
    name: 'Click Farm Worker',
    description: 'Real human-like timing but rushing — no Hick\'s Law scaling',
    decisions: [
      { options: 2, responseTime: 400 }, { options: 4, responseTime: 450 },
      { options: 8, responseTime: 420 }, { options: 16, responseTime: 380 },
      { options: 2, responseTime: 410 }, { options: 4, responseTime: 430 },
      { options: 8, responseTime: 400 }, { options: 16, responseTime: 420 },
    ],
    renders: [{ complexity: 'complex' }, { complexity: 'complex' }, { complexity: 'complex' }],
    events: [
      { type: 'page_visit', duration: 1000, interactions: 1, tier: 'passive' },
      { type: 'survey_answer', duration: 400, interactions: 1, tier: 'passive' },
      { type: 'survey_answer', duration: 420, interactions: 1, tier: 'passive' },
    ]
  }
];

const HUMAN_PROFILES = [
  {
    name: 'Focused Reader',
    description: 'Deep engagement — careful reading, Hick\'s Law compliant timing',
    decisions: [
      { options: 2, responseTime: 650 }, { options: 2, responseTime: 720 },
      { options: 4, responseTime: 950 }, { options: 4, responseTime: 1100 },
      { options: 8, responseTime: 1400 }, { options: 8, responseTime: 1250 },
      { options: 16, responseTime: 1800 }, { options: 16, responseTime: 2100 },
      { options: 4, responseTime: 880 }, { options: 8, responseTime: 1350 },
    ],
    renders: [{ complexity: 'simple' }, { complexity: 'moderate' }, { complexity: 'complex' }],
    events: [
      { type: 'page_visit', duration: 60000, interactions: 20, tier: 'deep' },
      { type: 'content_read', duration: 15000, interactions: 5, tier: 'deep' },
      { type: 'content_read', duration: 20000, interactions: 8, tier: 'deep' },
      { type: 'survey_answer', duration: 3000, interactions: 2, tier: 'deep' },
    ]
  },
  {
    name: 'Casual Browser',
    description: 'Moderate engagement — scanning, quick but human-paced responses',
    decisions: [
      { options: 2, responseTime: 500 }, { options: 2, responseTime: 550 },
      { options: 4, responseTime: 650 }, { options: 4, responseTime: 700 },
      { options: 8, responseTime: 800 }, { options: 8, responseTime: 900 },
      { options: 16, responseTime: 1000 }, { options: 16, responseTime: 1100 },
    ],
    renders: [{ complexity: 'simple' }, { complexity: 'moderate' }],
    events: [
      { type: 'page_visit', duration: 30000, interactions: 10, tier: 'active' },
      { type: 'content_read', duration: 5000, interactions: 3, tier: 'active' },
      { type: 'survey_answer', duration: 1500, interactions: 1, tier: 'active' },
    ]
  },
  {
    name: 'Distracted User',
    description: 'Low engagement — tab switching, long pauses, inconsistent timing',
    decisions: [
      { options: 2, responseTime: 1200 }, { options: 4, responseTime: 600 },
      { options: 8, responseTime: 3500 }, { options: 16, responseTime: 900 },
      { options: 2, responseTime: 2000 }, { options: 4, responseTime: 700 },
    ],
    renders: [{ complexity: 'simple' }, { complexity: 'moderate' }, { complexity: 'complex' }],
    events: [
      { type: 'page_visit', duration: 120000, interactions: 5, tier: 'passive' },
      { type: 'tab_return', duration: 30000, interactions: 0, tier: 'passive' },
      { type: 'survey_answer', duration: 3500, interactions: 1, tier: 'passive' },
    ]
  }
];

// ============================================================
// VERTICAL 1: BOT DETECTION
// ============================================================

function runBotDetection() {
  const botResults = BOT_PROFILES.map(p => runSimulation(p));
  const humanResults = HUMAN_PROFILES.map(p => runSimulation(p));

  const avgBot = botResults.reduce((s, r) => s + r.confidence.composite, 0) / botResults.length;
  const avgHuman = humanResults.reduce((s, r) => s + r.confidence.composite, 0) / humanResults.length;
  const bestBot = Math.max(...botResults.map(r => r.confidence.composite));
  const bestHuman = Math.max(...humanResults.map(r => r.confidence.composite));

  return {
    vertical: 'bot-detection',
    title: 'Bot vs Human Discrimination',
    description: '4 bot profiles vs 3 human profiles — behavioral signal separation',
    profiles: {
      bots: botResults.map(r => ({
        name: r.name,
        description: r.description,
        composite: round(r.confidence.composite),
        signals: {
          timing: round(r.confidence.timing),
          fitts: round(r.confidence.fitts),
          hicks: round(r.confidence.hicks),
          scroll: round(r.confidence.scroll),
          microPause: round(r.confidence.microPause),
          touch: round(r.confidence.touch)
        }
      })),
      humans: humanResults.map(r => ({
        name: r.name,
        description: r.description,
        composite: round(r.confidence.composite),
        signals: {
          timing: round(r.confidence.timing),
          fitts: round(r.confidence.fitts),
          hicks: round(r.confidence.hicks),
          scroll: round(r.confidence.scroll),
          microPause: round(r.confidence.microPause),
          touch: round(r.confidence.touch)
        }
      }))
    },
    summary: {
      avg_bot_score: round(avgBot),
      avg_human_score: round(avgHuman),
      separation_gap: round(avgHuman - avgBot),
      best_bot_score: round(bestBot),
      best_human_score: round(bestHuman),
      human_beats_best_bot: bestHuman > bestBot,
      bots_caught_at_050: botResults.filter(r => r.confidence.composite < 0.50).length,
      total_bots: botResults.length,
      humans_falsely_flagged: humanResults.filter(r => r.confidence.composite < 0.50).length,
      total_humans: humanResults.length,
    },
    verdict: bestHuman > bestBot ? 'PASS — Human clearly separable from bots' : 'NEEDS WORK'
  };
}

// ============================================================
// VERTICAL 2: CONTENT READING
// ============================================================

function runContentReading() {
  const SECTIONS = [
    { id: 'intro', wordCount: 150, title: 'Introduction' },
    { id: 'coverage', wordCount: 400, title: 'Coverage Details' },
    { id: 'exclusions', wordCount: 300, title: 'Exclusions' },
  ];

  function setupPolicy() {
    ContentTracker.reset();
    ContentTracker.init({ debug: false });
    SECTIONS.forEach((s, i) => ContentTracker.registerSection(s.id, { wordCount: s.wordCount, title: s.title, order: i }));
  }

  // Genuine reader: ~200 WPM, slow scroll, active signals
  setupPolicy();
  SECTIONS.forEach(s => {
    const readTimeMs = (s.wordCount / 200) * 60 * 1000;
    ContentTracker.simulateView(s.id, readTimeMs, {
      activeSignals: Math.floor(readTimeMs / 1500),
      scrollVelocities: makeScrollVelocities(0.2, 20),
      intersectionSamples: [0.8, 0.9, 1.0, 0.95, 0.85]
    });
  });
  const genuineResult = ContentTracker.scoreDocument();

  // Bot: scroll-to-bottom
  setupPolicy();
  SECTIONS.forEach(s => {
    ContentTracker.simulateView(s.id, 300, {
      activeSignals: 0,
      scrollVelocities: makeScrollVelocities(50, 5),
      intersectionSamples: [0.1, 0.05]
    });
  });
  const botResult = ContentTracker.scoreDocument();

  // Skimmer: fast but present
  setupPolicy();
  SECTIONS.forEach(s => {
    ContentTracker.simulateView(s.id, 8000, {
      activeSignals: 2,
      scrollVelocities: makeScrollVelocities(2.0, 10),
      intersectionSamples: [0.5, 0.6, 0.4]
    });
  });
  const skimmerResult = ContentTracker.scoreDocument();

  return {
    vertical: 'content-reading',
    title: 'Document Reading Verification',
    description: 'Can SWS tell if someone actually read an insurance policy vs scrolled past it?',
    profiles: {
      genuine_reader: {
        document_score: round(genuineResult.documentScore || 0),
        verdict: genuineResult.verdict || 'unknown',
        sections_read: genuineResult.sectionsRead || 0,
        sections_skimmed: genuineResult.sectionsSkimmed || 0,
        total_sections: genuineResult.totalSections || SECTIONS.length
      },
      scroll_bot: {
        document_score: round(botResult.documentScore || 0),
        verdict: botResult.verdict || 'unknown',
        sections_read: botResult.sectionsRead || 0,
        sections_skimmed: botResult.sectionsSkimmed || 0,
        total_sections: botResult.totalSections || SECTIONS.length
      },
      skimmer: {
        document_score: round(skimmerResult.documentScore || 0),
        verdict: skimmerResult.verdict || 'unknown',
        sections_read: skimmerResult.sectionsRead || 0,
        sections_skimmed: skimmerResult.sectionsSkimmed || 0,
        total_sections: skimmerResult.totalSections || SECTIONS.length
      }
    },
    summary: {
      genuine_vs_bot_ratio: round((genuineResult.documentScore || 0) / Math.max(botResult.documentScore || 0, 0.01)),
      genuine_vs_skimmer_ratio: round((genuineResult.documentScore || 0) / Math.max(skimmerResult.documentScore || 0, 0.01)),
      bot_correctly_identified: (botResult.verdict || '') === 'not_read',
      genuine_correctly_identified: (genuineResult.verdict || '').includes('read')
    },
    verdict: (genuineResult.documentScore || 0) > (botResult.documentScore || 0) * 2 ?
      'PASS — Genuine readers clearly separated from bots' : 'NEEDS WORK'
  };
}

// ============================================================
// VERTICAL 3: VIDEO ATTENTION
// ============================================================

function runVideoAttention() {
  // Genuine viewer: pauses, seeks back, mouse activity
  VideoTracker.reset();
  VideoTracker.init({});
  VideoTracker.setDuration(120);
  VideoTracker.recordPlay(0);
  for (let sec = 0; sec < 120; sec += 5) {
    VideoTracker.recordTimeUpdate(sec);
    VideoTracker.recordActivity('mousemove', sec);
  }
  VideoTracker.recordPause(30);
  VideoTracker.recordPlay(30);
  VideoTracker.recordPause(75);
  VideoTracker.recordPlay(75);
  VideoTracker.recordSeek(90, 60);
  const genuineVideo = VideoTracker.score();

  // Auto-play bot: no interaction, no pauses, no activity
  VideoTracker.reset();
  VideoTracker.init({});
  VideoTracker.setDuration(120);
  VideoTracker.recordPlay(0);
  for (let sec = 0; sec < 120; sec += 5) {
    VideoTracker.recordTimeUpdate(sec);
  }
  const botVideo = VideoTracker.score();

  // Distracted viewer: tab switches mid-video
  VideoTracker.reset();
  VideoTracker.init({});
  VideoTracker.setDuration(120);
  VideoTracker.recordPlay(0);
  for (let sec = 0; sec < 120; sec += 5) {
    VideoTracker.recordTimeUpdate(sec);
  }
  VideoTracker.recordVisibilityChange(false, 20);
  VideoTracker.recordVisibilityChange(true, 50);
  VideoTracker.recordVisibilityChange(false, 70);
  VideoTracker.recordVisibilityChange(true, 100);
  const distractedVideo = VideoTracker.score();

  return {
    vertical: 'video-attention',
    title: 'Video Watching Verification',
    description: 'Training video completion — genuine viewing vs auto-play vs tab-switched',
    profiles: {
      genuine_viewer: {
        composite: round(genuineVideo.composite || 0),
        completion_pct: genuineVideo.stats?.completionPercent || 0,
        focus_pct: genuineVideo.stats?.focusPercent || 0,
        pauses: genuineVideo.stats?.pauseCount || 0,
        seek_backs: genuineVideo.stats?.seekBackCount || 0,
        verdict: genuineVideo.verdict || 'unknown'
      },
      autoplay_bot: {
        composite: round(botVideo.composite || 0),
        completion_pct: botVideo.stats?.completionPercent || 0,
        focus_pct: botVideo.stats?.focusPercent || 0,
        pauses: botVideo.stats?.pauseCount || 0,
        seek_backs: botVideo.stats?.seekBackCount || 0,
        verdict: botVideo.verdict || 'unknown'
      },
      distracted_viewer: {
        composite: round(distractedVideo.composite || 0),
        completion_pct: distractedVideo.stats?.completionPercent || 0,
        focus_pct: distractedVideo.stats?.focusPercent || 0,
        pauses: distractedVideo.stats?.pauseCount || 0,
        seek_backs: distractedVideo.stats?.seekBackCount || 0,
        verdict: distractedVideo.verdict || 'unknown'
      }
    },
    summary: {
      genuine_vs_bot_ratio: round((genuineVideo.composite || 0) / Math.max(botVideo.composite || 0, 0.01)),
      genuine_correctly_identified: (genuineVideo.composite || 0) > 0.55,
      bot_correctly_lower: (botVideo.composite || 0) < (genuineVideo.composite || 0)
    },
    verdict: (genuineVideo.composite || 0) > (botVideo.composite || 0) ?
      'PASS — Genuine viewers clearly separated from auto-play' : 'NEEDS WORK'
  };
}

// ============================================================
// VERTICAL 4: FATIGUE DETECTION
// ============================================================

function runFatigueDetection() {
  // FRESH CHECK: Establish baseline, then check with near-baseline values
  BaselineProfiler.reset();
  BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
  feedBaseline(BaselineProfiler, { reactionTimeMean: 280, precisionMean: 5, count: 25 });
  BaselineProfiler.lockBaseline();

  const baseline = BaselineProfiler.getBaseline();

  // Fresh performance — deterministic, close to baseline
  for (let i = 0; i < 10; i++) {
    BaselineProfiler.recordReactionTime(275 + (i % 3) * 10);   // 275, 285, 295 cycle
    BaselineProfiler.recordClickPrecision(5 + (i % 3) * 0.5);  // 5.0, 5.5, 6.0 cycle
    BaselineProfiler.recordScroll();
    BaselineProfiler.recordMousePosition(100 + i * 5, 200 + i * 2);
  }
  const freshDrift = BaselineProfiler.getDrift();

  // FATIGUE CHECK: Fresh baseline, then severely degraded
  BaselineProfiler.reset();
  BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
  feedBaseline(BaselineProfiler, { reactionTimeMean: 280, precisionMean: 5, count: 25 });
  BaselineProfiler.lockBaseline();

  // Fatigued performance — 80% slower, much less precise
  for (let i = 0; i < 10; i++) {
    BaselineProfiler.recordReactionTime(500 + i * 10);         // 500-590ms (was 280)
    BaselineProfiler.recordClickPrecision(12 + i * 0.5);       // 12-16.5 (was 5)
    BaselineProfiler.recordScroll();
    BaselineProfiler.recordMousePosition(100 + i * 5 + (i % 4) * 8, 200 + i * 2 + (i % 3) * 6);
  }
  const fatigueDrift = BaselineProfiler.getDrift();

  return {
    vertical: 'fatigue-detection',
    title: 'Performance Fatigue / Degradation Detection',
    description: 'Baseline profiling detects when soldiers, doctors, or operators are fatigued',
    baseline: {
      reaction_time_mean: round(baseline?.reactionTime?.mean || 0),
      click_precision_mean: round(baseline?.clickPrecision?.mean || 0),
      samples: baseline?.reactionTime?.count || 0
    },
    scenarios: {
      fresh_performance: {
        drift_level: freshDrift.level || 'unknown',
        drift_score: round(freshDrift.driftScore || 0),
        degraded_signals: freshDrift.degradedSignals || 0,
        verdict: (freshDrift.level === 'normal') ? 'FIT FOR DUTY' : 'REVIEW NEEDED'
      },
      fatigued_6_hours: {
        drift_level: fatigueDrift.level || 'unknown',
        drift_score: round(fatigueDrift.driftScore || 0),
        degraded_signals: fatigueDrift.degradedSignals || 0,
        recommendation: fatigueDrift.recommendation || 'N/A',
        rt_baseline: round(fatigueDrift.signals?.reactionTime?.baselineMean || 0),
        rt_current: round(fatigueDrift.signals?.reactionTime?.currentMean || 0),
        rt_drift_pct: fatigueDrift.signals?.reactionTime?.drift ?
          round(fatigueDrift.signals.reactionTime.drift * 100) + '%' : 'N/A',
        verdict: (fatigueDrift.level !== 'normal') ? 'FATIGUE DETECTED' : 'FIT FOR DUTY'
      }
    },
    summary: {
      fresh_within_tolerance: (freshDrift.level === 'normal' || freshDrift.level === 'warning'),
      fatigue_correctly_caught: (fatigueDrift.level === 'alert' || fatigueDrift.level === 'critical'),
      separation: fatigueDrift.driftScore - freshDrift.driftScore
    },
    verdict: ((freshDrift.level === 'normal' || freshDrift.level === 'warning') &&
              (fatigueDrift.level === 'alert' || fatigueDrift.level === 'critical')) ?
      'PASS — Normal vs fatigued states correctly discriminated' : 'NEEDS WORK'
  };
}

// ============================================================
// VERTICAL 5: SESSION INTEGRITY
// ============================================================

function runSessionIntegrity() {
  // Legitimate session (uses the real API format)
  const legit = IntegrityValidator.validate({
    session_id: 'proof_legit',
    duration_ms: 120000,
    interaction_count: 45,
    hash_count: 8,
    interaction_intervals: [312, 445, 278, 512, 389, 267, 401, 356, 490, 321, 378, 412, 289, 467, 345, 398, 456, 301, 378, 423],
    tap_sequence: [
      { x: 100, y: 200, t: 1000 }, { x: 150, y: 250, t: 1400 },
      { x: 80, y: 180, t: 1800 }, { x: 200, y: 300, t: 2200 },
      { x: 120, y: 220, t: 2600 }, { x: 170, y: 270, t: 3000 },
      { x: 90, y: 190, t: 3400 }, { x: 210, y: 310, t: 3900 },
      { x: 130, y: 230, t: 4300 }, { x: 160, y: 260, t: 4700 }
    ],
    scroll_events: [{ y: 0, t: 1000 }, { y: 100, t: 1500 }, { y: 250, t: 2000 }, { y: 300, t: 2800 }, { y: 450, t: 3500 }],
    decisions: [
      { optionCount: 3, responseTimeMs: 800 }, { optionCount: 5, responseTimeMs: 1200 },
      { optionCount: 2, responseTimeMs: 600 }, { optionCount: 4, responseTimeMs: 1000 }
    ]
  });

  // Naive bot (constant intervals, same position)
  const naiveBot = IntegrityValidator.validate({
    session_id: 'proof_naive_bot',
    duration_ms: 1000,
    interaction_count: 8,
    hash_count: 8,
    interaction_intervals: [100, 100, 100, 100, 100, 100, 100, 100],
    tap_sequence: [
      { x: 200, y: 300, t: 1000 }, { x: 200, y: 300, t: 1100 },
      { x: 200, y: 300, t: 1200 }, { x: 200, y: 300, t: 1300 },
      { x: 200, y: 300, t: 1400 }, { x: 200, y: 300, t: 1500 },
      { x: 200, y: 300, t: 1600 }, { x: 200, y: 300, t: 1700 }
    ],
    scroll_events: [],
    decisions: [{ optionCount: 4, responseTimeMs: 50 }, { optionCount: 4, responseTimeMs: 50 }]
  });

  // Smart bot (jittered timing, but nearly identical positions)
  const smartBot = IntegrityValidator.validate({
    session_id: 'proof_smart_bot',
    duration_ms: 8000,
    interaction_count: 8,
    hash_count: 4,
    interaction_intervals: [850, 850, 1200, 700, 1200, 700, 1400],
    tap_sequence: [
      { x: 200, y: 300, t: 1000 }, { x: 201, y: 301, t: 1850 },
      { x: 200, y: 300, t: 2700 }, { x: 202, y: 299, t: 3900 },
      { x: 200, y: 300, t: 4600 }, { x: 201, y: 300, t: 5800 },
      { x: 200, y: 301, t: 6500 }, { x: 200, y: 300, t: 7900 }
    ],
    scroll_events: [],
    decisions: [
      { optionCount: 4, responseTimeMs: 180 }, { optionCount: 4, responseTimeMs: 220 },
      { optionCount: 4, responseTimeMs: 195 }, { optionCount: 4, responseTimeMs: 240 }
    ]
  });

  return {
    vertical: 'session-integrity',
    title: 'Session Fraud Detection',
    description: 'Detects fabricated, replayed, and tampered session data',
    sessions: {
      legitimate: {
        integrity: legit.integrity,
        checks_passed: legit.passedChecks + '/' + legit.totalChecks,
        critical_findings: (legit.findings || []).filter(f => f.severity === 'critical').length
      },
      naive_bot: {
        integrity: naiveBot.integrity,
        checks_passed: naiveBot.passedChecks + '/' + naiveBot.totalChecks,
        critical_findings: (naiveBot.findings || []).filter(f => f.severity === 'critical').length,
        findings: (naiveBot.findings || []).filter(f => f.severity === 'critical').map(f => f.check + ': ' + f.detail).slice(0, 5)
      },
      smart_bot: {
        integrity: smartBot.integrity,
        checks_passed: smartBot.passedChecks + '/' + smartBot.totalChecks,
        critical_findings: (smartBot.findings || []).filter(f => f.severity === 'critical').length,
        findings: (smartBot.findings || []).filter(f => f.severity === 'critical').map(f => f.check + ': ' + f.detail).slice(0, 5)
      }
    },
    summary: {
      legit_correctly_passed: legit.integrity === 'valid',
      naive_bot_caught: naiveBot.integrity !== 'valid',
      smart_bot_caught: smartBot.integrity !== 'valid'
    },
    verdict: (legit.integrity === 'valid' && naiveBot.integrity !== 'valid' && smartBot.integrity !== 'valid') ?
      'PASS — Legitimate sessions pass, fraudulent sessions caught' : 'NEEDS WORK'
  };
}

// ============================================================
// VERTICAL 6: TEMPORAL (IN-SESSION FATIGUE)
// ============================================================

function runTemporalAnalysis() {
  // Sustained attention: stable metrics across 5 windows
  TemporalAnalyzer.reset();
  TemporalAnalyzer.init({ windowSizeMs: 300000 });
  const stableSession = generateSession(5, {
    rtStart: 300, rtEnd: 310, precStart: 5, precEnd: 5.2,
    jitterStart: 1.0, jitterEnd: 1.05, eventsPerWindow: 20
  });
  TemporalAnalyzer.injectEvents(stableSession.events, stableSession.sessionStart);
  const sustained = TemporalAnalyzer.analyze();

  // Exam fatigue: RT doubles over 6 windows
  TemporalAnalyzer.reset();
  TemporalAnalyzer.init({ windowSizeMs: 300000 });
  const fatigueSession = generateSession(6, {
    rtStart: 280, rtEnd: 500, precStart: 4, precEnd: 10,
    jitterStart: 1.0, jitterEnd: 3.0, eventsPerWindow: 20
  });
  TemporalAnalyzer.injectEvents(fatigueSession.events, fatigueSession.sessionStart);
  const fatigued = TemporalAnalyzer.analyze();

  return {
    vertical: 'temporal-analysis',
    title: 'In-Session Attention Tracking',
    description: 'Detects attention drift and fatigue within a single session over time',
    scenarios: {
      sustained_attention: {
        verdict: sustained.verdict,
        degradation: round(sustained.overallDegradation || 0),
        windows: sustained.validWindowCount || 0
      },
      exam_fatigue: {
        verdict: fatigued.verdict,
        degradation: round(fatigued.overallDegradation || 0),
        rt_trend: fatigued.trends?.reactionTime?.interpretation || 'unknown',
        rt_change_pct: fatigued.trends?.reactionTime?.pctChange ?
          round(fatigued.trends.reactionTime.pctChange * 100) : 0
      }
    },
    summary: {
      sustained_correctly_identified: sustained.verdict === 'sustained_attention',
      fatigue_correctly_caught: fatigued.verdict !== 'sustained_attention'
    },
    verdict: (sustained.verdict === 'sustained_attention' && fatigued.verdict !== 'sustained_attention') ?
      'PASS — Sustained vs fatigued correctly discriminated' : 'NEEDS WORK'
  };
}

// ============================================================
// VERTICAL 7: INDUSTRY VERTICAL SCORING
// ============================================================

function runVerticalProfiles() {
  // Same session signals scored for different industries
  const signals = {
    reactionTime: 0.75,
    reactionTimeConsistency: 0.80,
    clickPrecision: 0.85,
    sustainedFocus: 0.70,
    documentComprehension: 0.60,
    fatigueResistance: 0.80
  };

  const verticalNames = VerticalProfiles.getProfileNames();
  const scores = {};

  verticalNames.forEach(v => {
    const result = VerticalProfiles.score(v, signals);
    scores[v] = {
      composite: round(result.composite || 0),
      verdict: result.verdict || 'unknown'
    };
  });

  return {
    vertical: 'vertical-profiles',
    title: 'Industry-Specific Scoring',
    description: 'Same behavioral signals produce different scores/verdicts per industry vertical',
    input_signals: signals,
    industry_scores: scores,
    summary: {
      industries_covered: verticalNames.length,
      scores_differ: new Set(Object.values(scores).map(s => s.composite)).size > 1,
      all_scored: Object.values(scores).every(s => s.composite > 0)
    },
    verdict: new Set(Object.values(scores).map(s => s.composite)).size > 1 ?
      'PASS — Same data produces different verdicts per industry context' : 'NEEDS WORK'
  };
}

// ============================================================
// MASTER RUNNER
// ============================================================

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function generateRunId() {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const hash = crypto.randomBytes(4).toString('hex');
  return `proof-${date}-${hash}`;
}

function runAllProofs() {
  const runId = generateRunId();
  const startTime = Date.now();

  const verticals = {
    'bot-detection': safeRun('bot-detection', runBotDetection),
    'content-reading': safeRun('content-reading', runContentReading),
    'video-attention': safeRun('video-attention', runVideoAttention),
    'fatigue-detection': safeRun('fatigue-detection', runFatigueDetection),
    'session-integrity': safeRun('session-integrity', runSessionIntegrity),
    'temporal-analysis': safeRun('temporal-analysis', runTemporalAnalysis),
    'vertical-profiles': safeRun('vertical-profiles', runVerticalProfiles),
  };

  const passed = Object.values(verticals).filter(v => v.verdict && v.verdict.startsWith('PASS')).length;
  const total = Object.keys(verticals).length;

  return {
    run_id: runId,
    protocol: 'SWS Proof of Attention Protocol',
    entity: 'SWS Strategic Media LLC',
    patent: 'SWS-PROV-001',
    generated: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    summary: {
      verticals_passed: passed,
      verticals_total: total,
      pass_rate: round(passed / total),
      all_passed: passed === total
    },
    verticals: verticals
  };
}

function safeRun(name, fn) {
  try {
    return fn();
  } catch (err) {
    return {
      vertical: name,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
      verdict: 'ERROR — ' + err.message
    };
  }
}

// ============================================================
// CLI EXECUTION
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const verticalArg = args.find(a => a.startsWith('--vertical='));
  const selectedVertical = verticalArg ? verticalArg.split('=')[1] : null;

  if (!jsonOnly) {
    console.log('');
    console.log('='.repeat(70));
    console.log('  SWS PROOF OF ATTENTION PROTOCOL — Proof Runner');
    console.log('  (c) 2026 SWS Strategic Media LLC');
    console.log('='.repeat(70));
    console.log('');
  }

  const results = runAllProofs();

  if (jsonOnly) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    // Print human-readable summary
    Object.entries(results.verticals).forEach(([key, v]) => {
      const icon = v.verdict && v.verdict.startsWith('PASS') ? 'PASS' : v.verdict && v.verdict.startsWith('ERROR') ? 'ERR ' : 'WARN';
      console.log(`  [${icon}] ${(v.title || key).padEnd(42)} ${v.verdict || 'No verdict'}`);
    });

    console.log('');
    console.log('-'.repeat(70));
    console.log(`  Verticals: ${results.summary.verticals_passed}/${results.summary.verticals_total} passed`);
    console.log(`  Run ID:    ${results.run_id}`);
    console.log(`  Duration:  ${results.duration_ms}ms`);
    console.log('-'.repeat(70));

    // Write results to file
    const resultsDir = path.resolve(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const outPath = path.join(resultsDir, `${results.run_id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`  Results:   ${outPath}`);

    // Also write latest.json for the gallery
    const latestPath = path.join(resultsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(results, null, 2));
    console.log(`  Latest:    ${latestPath}`);
    console.log('');
  }

  process.exit(0);
}

module.exports = { runAllProofs, runBotDetection, runContentReading, runVideoAttention,
  runFatigueDetection, runSessionIntegrity, runTemporalAnalysis, runVerticalProfiles };
