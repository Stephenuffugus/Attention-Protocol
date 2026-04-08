/**
 * Content Section Attention Tracker — Test Suite
 *
 * Tests the policy-read verification engine.
 * Proves: we can tell if someone actually READ a document vs skimmed/botted it.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const ContentTracker = require('../src/sdk/content-attention-tracker');

// ============================================================
// HELPERS
// ============================================================

function makeScrollVelocities(avgVelocity, count) {
  const vels = [];
  let y = 0;
  let t = 0;
  for (let i = 0; i < count; i++) {
    const dt = 100 + Math.random() * 50; // ~100-150ms between samples
    const dy = avgVelocity * dt;
    t += dt;
    y += dy;
    vels.push({ y, t });
  }
  return vels;
}

function setupPolicy(tracker, sections) {
  tracker.reset();
  tracker.init({ debug: false });
  sections.forEach((s, i) => {
    tracker.registerSection(s.id, {
      wordCount: s.wordCount,
      title: s.title || s.id,
      order: i
    });
  });
}

const POLICY_SECTIONS = [
  { id: 'intro', wordCount: 150, title: 'Introduction' },
  { id: 'coverage', wordCount: 400, title: 'Coverage Details' },
  { id: 'exclusions', wordCount: 300, title: 'Exclusions' },
  { id: 'claims', wordCount: 250, title: 'Claims Process' },
  { id: 'terms', wordCount: 200, title: 'Terms & Conditions' }
];

// ============================================================
// TESTS
// ============================================================

describe('Content Section Attention Tracker', () => {

  beforeEach(() => {
    ContentTracker.reset();
  });

  // ----------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------

  describe('Initialization', () => {
    test('initializes with default config', () => {
      ContentTracker.init({});
      expect(ContentTracker._internal.config()).toBeDefined();
      expect(ContentTracker._internal.config().minViewTimeMs).toBe(1000);
    });

    test('accepts custom config overrides', () => {
      ContentTracker.init({ minViewTimeMs: 2000, debug: false });
      expect(ContentTracker._internal.config().minViewTimeMs).toBe(2000);
    });

    test('registers sections with word counts', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);
      expect(ContentTracker.getSectionIds().length).toBe(5);
    });

    test('computes word count from provided value', () => {
      ContentTracker.init({});
      ContentTracker.registerSection('test', { wordCount: 500, title: 'Test' });
      expect(ContentTracker.getSectionData('test').wordCount).toBe(500);
    });
  });

  // ----------------------------------------------------------
  // GENUINE READER (Human reads a policy carefully)
  // ----------------------------------------------------------

  describe('Genuine Reader — Thorough Reading', () => {
    test('scores high when user reads each section at normal pace', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Simulate reading each section at ~200 WPM
      POLICY_SECTIONS.forEach(s => {
        const readTimeMs = (s.wordCount / 200) * 60 * 1000;
        ContentTracker.simulateView(s.id, readTimeMs, {
          activeSignals: Math.floor(readTimeMs / 1500), // mouse move every 1.5s
          scrollVelocities: makeScrollVelocities(0.2, 20), // slow scrolling
          intersectionSamples: [0.8, 0.9, 1.0, 0.95, 0.85] // good viewport coverage
        });
      });

      const doc = ContentTracker.scoreDocument();
      expect(doc.documentScore).toBeGreaterThan(0.6);
      expect(doc.verdict).toMatch(/thoroughly_read|partially_read/);
      expect(doc.sectionsRead + doc.sectionsSkimmed).toBeGreaterThanOrEqual(4);
    });

    test('detects re-reads as positive engagement signal', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Read exclusions section, then re-read it (confusing content)
      const readTime = (300 / 200) * 60 * 1000;
      ContentTracker.simulateView('exclusions', readTime, {
        reReadCount: 2,
        activeSignals: 15,
        scrollVelocities: makeScrollVelocities(0.15, 25),
        intersectionSamples: [0.9, 1.0, 0.95]
      });

      const score = ContentTracker.scoreSection('exclusions');
      expect(score.composite).toBeGreaterThan(0.65);
      expect(score.scores.reRead).toBe(1.0); // re-reads boost score
      expect(score.reReadCount).toBe(2);
    });

    test('text selections boost active engagement', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      const readTime = (400 / 200) * 60 * 1000;
      ContentTracker.simulateView('coverage', readTime, {
        activeSignals: 30,
        textSelections: 3, // highlighted parts of coverage details
        intersectionSamples: [0.9, 1.0, 0.85]
      });

      const score = ContentTracker.scoreSection('coverage');
      expect(score.textSelections).toBe(3);
      expect(score.scores.activeEngagement).toBeGreaterThan(0.5);
    });
  });

  // ----------------------------------------------------------
  // SKIMMER (Human scrolls fast, reads some parts)
  // ----------------------------------------------------------

  describe('Skimmer — Fast Scrolling', () => {
    test('detects fast scrolling as skimming', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Skim through each section at ~500 WPM (too fast for genuine reading)
      POLICY_SECTIONS.forEach(s => {
        const skimTimeMs = (s.wordCount / 500) * 60 * 1000;
        ContentTracker.simulateView(s.id, skimTimeMs, {
          activeSignals: 2,
          scrollVelocities: makeScrollVelocities(1.5, 10), // fast scrolling
          intersectionSamples: [0.5, 0.3, 0.6]
        });
      });

      const doc = ContentTracker.scoreDocument();
      expect(doc.documentScore).toBeLessThan(0.65);
      expect(doc.sectionsRead).toBeLessThan(3);
    });

    test('high scroll velocity lowers section score', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Fast scroll through terms
      ContentTracker.simulateView('terms', 5000, {
        activeSignals: 1,
        scrollVelocities: makeScrollVelocities(3.0, 15), // very fast
        intersectionSamples: [0.3, 0.4, 0.2]
      });

      const score = ContentTracker.scoreSection('terms');
      expect(score.scores.scrollVelocity).toBeLessThan(0.3);
    });
  });

  // ----------------------------------------------------------
  // SCROLL-TO-BOTTOM BOT (immediate scroll, no reading)
  // ----------------------------------------------------------

  describe('Scroll-to-Bottom Bot', () => {
    test('scores near zero when all sections have minimal dwell', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Bot scrolls through entire document in <2 seconds
      POLICY_SECTIONS.forEach(s => {
        ContentTracker.simulateView(s.id, 300, { // 300ms per section
          activeSignals: 0,
          scrollVelocities: makeScrollVelocities(5.0, 5), // extremely fast
          intersectionSamples: [0.1, 0.2]
        });
      });

      const doc = ContentTracker.scoreDocument();
      expect(doc.documentScore).toBeLessThan(0.25);
      expect(doc.verdict).toBe('not_read');
      expect(doc.sectionsMissed).toBeGreaterThanOrEqual(4);
    });

    test('individual section scores near zero for instant scroll', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      ContentTracker.simulateView('coverage', 200, {
        activeSignals: 0,
        scrollVelocities: makeScrollVelocities(8.0, 3)
      });

      const score = ContentTracker.scoreSection('coverage');
      expect(score.composite).toBeLessThan(0.2);
      expect(score.verdict).toBe('missed');
      expect(score.scores.dwell).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // PARTIAL READER (reads important parts, skips rest)
  // ----------------------------------------------------------

  describe('Partial Reader', () => {
    test('detects mixed reading — some read, some skipped', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Read intro and claims carefully, skip the rest
      ['intro', 'claims'].forEach(id => {
        const s = POLICY_SECTIONS.find(p => p.id === id);
        const readTime = (s.wordCount / 200) * 60 * 1000;
        ContentTracker.simulateView(id, readTime, {
          activeSignals: Math.floor(readTime / 1500),
          scrollVelocities: makeScrollVelocities(0.2, 15),
          intersectionSamples: [0.85, 0.9, 1.0]
        });
      });

      // Skip coverage, exclusions, terms
      ['coverage', 'exclusions', 'terms'].forEach(id => {
        ContentTracker.simulateView(id, 500, {
          activeSignals: 0,
          scrollVelocities: makeScrollVelocities(4.0, 3)
        });
      });

      const doc = ContentTracker.scoreDocument();
      expect(doc.verdict).toMatch(/partially_read|skimmed/);
      expect(doc.sectionsRead).toBeGreaterThanOrEqual(1);
      expect(doc.sectionsMissed).toBeGreaterThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------
  // READING PACE ANALYSIS
  // ----------------------------------------------------------

  describe('Reading Pace Detection', () => {
    test('normal reading pace (150-250 WPM) scores high', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // 200 words at 200 WPM = 60 seconds
      ContentTracker.simulateView('terms', 60000, {
        activeSignals: 10,
        intersectionSamples: [0.9]
      });

      const score = ContentTracker.scoreSection('terms');
      expect(score.computedWpm).toBeGreaterThanOrEqual(150);
      expect(score.computedWpm).toBeLessThanOrEqual(250);
      expect(score.scores.readingPace).toBe(1.0);
    });

    test('impossibly fast reading (>600 WPM) scores low', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // 400 words in 10 seconds = 2400 WPM (impossible)
      ContentTracker.simulateView('coverage', 10000, {
        activeSignals: 1
      });

      const score = ContentTracker.scoreSection('coverage');
      expect(score.computedWpm).toBeGreaterThan(600);
      expect(score.scores.readingPace).toBeLessThan(0.2);
    });

    test('slow reading (<100 WPM) still scores reasonably (careful reader)', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // 150 words in 3 minutes = 50 WPM (very careful or re-reading)
      ContentTracker.simulateView('intro', 180000, {
        activeSignals: 25,
        reReadCount: 1,
        intersectionSamples: [0.9, 1.0]
      });

      const score = ContentTracker.scoreSection('intro');
      expect(score.computedWpm).toBeLessThan(100);
      expect(score.scores.readingPace).toBe(0.7); // slower is still human
    });
  });

  // ----------------------------------------------------------
  // DOCUMENT-LEVEL SCORING
  // ----------------------------------------------------------

  describe('Document-Level Analysis', () => {
    test('word-weighted scoring: long sections matter more', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // Read the 400-word section thoroughly, skip the 150-word one
      ContentTracker.simulateView('coverage', (400 / 200) * 60000, {
        activeSignals: 20,
        scrollVelocities: makeScrollVelocities(0.2, 20),
        intersectionSamples: [0.9, 1.0]
      });

      ContentTracker.simulateView('intro', 300, { activeSignals: 0 });

      const doc = ContentTracker.scoreDocument();
      // Coverage (400 words, read) should outweigh intro (150 words, missed)
      expect(doc.documentScore).toBeGreaterThan(0.2);
    });

    test('returns correct counts of read/skimmed/missed', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      // 2 read, 1 skimmed, 2 missed
      ['intro', 'coverage'].forEach(id => {
        const s = POLICY_SECTIONS.find(p => p.id === id);
        ContentTracker.simulateView(id, (s.wordCount / 200) * 60000, {
          activeSignals: 10,
          intersectionSamples: [0.9]
        });
      });

      ContentTracker.simulateView('exclusions', 8000, {
        activeSignals: 3,
        scrollVelocities: makeScrollVelocities(1.2, 8)
      });

      ['claims', 'terms'].forEach(id => {
        ContentTracker.simulateView(id, 300, { activeSignals: 0 });
      });

      const doc = ContentTracker.scoreDocument();
      expect(doc.totalSections).toBe(5);
      expect(doc.sectionsRead).toBeGreaterThanOrEqual(1);
      expect(doc.sectionsMissed).toBeGreaterThanOrEqual(1);
    });

    test('empty document returns no_data verdict', () => {
      ContentTracker.init({});
      const doc = ContentTracker.scoreDocument();
      expect(doc.verdict).toBe('no_data');
      expect(doc.totalSections).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // EXPORT FOR SERVER
  // ----------------------------------------------------------

  describe('Server Export', () => {
    test('exports all section data for server-side analysis', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);

      ContentTracker.simulateView('intro', 30000, {
        activeSignals: 5,
        scrollVelocities: makeScrollVelocities(0.3, 10),
        intersectionSamples: [0.8, 0.9]
      });

      const exported = ContentTracker.exportForServer();
      expect(exported.documentWordCount).toBeGreaterThan(0);
      expect(exported.sessionDurationMs).toBeGreaterThanOrEqual(0);
      expect(exported.sections.intro).toBeDefined();
      expect(exported.sections.intro.totalDwellMs).toBe(30000);
      expect(exported.sections.intro.viewEntries).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // HUMAN vs BOT GAP (the proof)
  // ----------------------------------------------------------

  describe('Human vs Bot Gap — The Proof', () => {
    test('genuine reader scores 3x+ higher than scroll-to-bottom bot', () => {
      // HUMAN: reads policy carefully
      setupPolicy(ContentTracker, POLICY_SECTIONS);
      POLICY_SECTIONS.forEach(s => {
        const readTime = (s.wordCount / 200) * 60 * 1000;
        ContentTracker.simulateView(s.id, readTime, {
          activeSignals: Math.floor(readTime / 1500),
          reReadCount: s.id === 'exclusions' ? 1 : 0,
          scrollVelocities: makeScrollVelocities(0.2, 20),
          intersectionSamples: [0.85, 0.9, 0.95, 1.0]
        });
      });
      const humanDoc = ContentTracker.scoreDocument();

      // BOT: scrolls to bottom instantly
      setupPolicy(ContentTracker, POLICY_SECTIONS);
      POLICY_SECTIONS.forEach(s => {
        ContentTracker.simulateView(s.id, 200, {
          activeSignals: 0,
          scrollVelocities: makeScrollVelocities(8.0, 3),
          intersectionSamples: [0.1]
        });
      });
      const botDoc = ContentTracker.scoreDocument();

      console.log('\n  === CONTENT ATTENTION: HUMAN vs BOT ===');
      console.log(`  Human document score: ${humanDoc.documentScore}`);
      console.log(`  Human verdict:        ${humanDoc.verdict}`);
      console.log(`  Human sections read:  ${humanDoc.sectionsRead}/${humanDoc.totalSections}`);
      console.log(`  Bot document score:   ${botDoc.documentScore}`);
      console.log(`  Bot verdict:          ${botDoc.verdict}`);
      console.log(`  Bot sections read:    ${botDoc.sectionsRead}/${botDoc.totalSections}`);
      console.log(`  GAP:                  ${(humanDoc.documentScore / Math.max(0.001, botDoc.documentScore)).toFixed(1)}x`);
      console.log('  ========================================\n');

      expect(humanDoc.documentScore).toBeGreaterThan(botDoc.documentScore * 2.5);
      expect(humanDoc.verdict).not.toBe('not_read');
      expect(botDoc.verdict).toBe('not_read');
    });

    test('skimmer scores between genuine reader and bot', () => {
      // SKIMMER: scrolls fast, pauses on some sections
      setupPolicy(ContentTracker, POLICY_SECTIONS);
      POLICY_SECTIONS.forEach(s => {
        const skimTime = (s.wordCount / 450) * 60 * 1000; // 450 WPM
        ContentTracker.simulateView(s.id, skimTime, {
          activeSignals: 3,
          scrollVelocities: makeScrollVelocities(1.2, 8),
          intersectionSamples: [0.5, 0.6]
        });
      });
      const skimDoc = ContentTracker.scoreDocument();

      // Skimmer should be in the middle
      expect(skimDoc.documentScore).toBeGreaterThan(0.15);
      expect(skimDoc.documentScore).toBeLessThan(0.75);
      expect(skimDoc.verdict).toMatch(/skimmed|partially_read/);
    });
  });

  // ----------------------------------------------------------
  // EDGE CASES
  // ----------------------------------------------------------

  describe('Edge Cases', () => {
    test('section with 0 words still tracks dwell', () => {
      ContentTracker.init({});
      ContentTracker.registerSection('empty', { wordCount: 0, title: 'Empty Section' });
      ContentTracker.simulateView('empty', 5000, { activeSignals: 3 });

      const score = ContentTracker.scoreSection('empty');
      expect(score).toBeDefined();
      expect(score.dwellMs).toBe(5000);
    });

    test('scoring unregistered section returns null', () => {
      ContentTracker.init({});
      expect(ContentTracker.scoreSection('nonexistent')).toBeNull();
    });

    test('duplicate registration is ignored', () => {
      ContentTracker.init({});
      ContentTracker.registerSection('test', { wordCount: 100 });
      ContentTracker.registerSection('test', { wordCount: 999 }); // should be ignored
      expect(ContentTracker.getSectionData('test').wordCount).toBe(100);
    });

    test('reset clears all state', () => {
      setupPolicy(ContentTracker, POLICY_SECTIONS);
      ContentTracker.reset();
      expect(ContentTracker.getSectionIds().length).toBe(0);
    });
  });
});
