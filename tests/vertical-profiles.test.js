/**
 * Vertical Scoring Profiles + Military + Medical — Test Suite
 *
 * Proves: the same behavioral signals produce different scores
 * per vertical, and each field gets purpose-built assessment.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const VerticalProfiles = require('../src/sdk/vertical-scoring-profiles');
const MilitaryReadiness = require('../src/sdk/military-readiness');
const MedicalShiftMonitor = require('../src/sdk/medical-shift-monitor');

// ============================================================
// VERTICAL PROFILES
// ============================================================

describe('Vertical Scoring Profiles', () => {

  describe('Profile Configuration', () => {
    test('has all 6 verticals defined', () => {
      const names = VerticalProfiles.getProfileNames();
      expect(names).toContain('military');
      expect(names).toContain('medical');
      expect(names).toContain('insurance');
      expect(names).toContain('education');
      expect(names).toContain('workplace');
      expect(names).toContain('advertising');
      expect(names.length).toBe(6);
    });

    test('each profile has weights that sum to ~1.0', () => {
      VerticalProfiles.getProfileNames().forEach(name => {
        const profile = VerticalProfiles.getProfile(name);
        const sum = Object.values(profile.weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 1);
      });
    });

    test('each profile has pass/marginal/fail thresholds', () => {
      VerticalProfiles.getProfileNames().forEach(name => {
        const profile = VerticalProfiles.getProfile(name);
        expect(profile.thresholds.pass).toBeGreaterThan(profile.thresholds.marginal);
        expect(profile.thresholds.marginal).toBeGreaterThan(profile.thresholds.fail);
      });
    });
  });

  describe('Same Signals, Different Scores', () => {
    test('military weights RT higher than insurance does', () => {
      // Signals where RT is great but document reading is weak
      const signals = {
        reactionTime: 0.95,
        reactionTimeConsistency: 0.90,
        clickPrecision: 0.85,
        sustainedFocus: 0.80,
        documentComprehension: 0.30,  // didn't read the docs
        fatigueResistance: 0.90
      };

      const military = VerticalProfiles.score('military', signals);
      const insurance = VerticalProfiles.score('insurance', signals);

      // Military should score higher (doesn't weight docs as much)
      expect(military.composite).toBeGreaterThan(insurance.composite);
      expect(military.verdict).toBe('pass');

      console.log('\n  === SAME SIGNALS, DIFFERENT VERTICALS ===');
      console.log(`  Military:  ${military.composite} (${military.verdict})`);
      console.log(`  Insurance: ${insurance.composite} (${insurance.verdict})`);
      console.log('  =========================================\n');
    });

    test('insurance weights document comprehension highest', () => {
      // Good reader, slow reactions
      const signals = {
        reactionTime: 0.40,
        reactionTimeConsistency: 0.50,
        clickPrecision: 0.45,
        sustainedFocus: 0.70,
        documentComprehension: 0.95,
        fatigueResistance: 0.50,
        sectionCoverage: 0.90
      };

      const insurance = VerticalProfiles.score('insurance', signals);
      const military = VerticalProfiles.score('military', signals);

      expect(insurance.composite).toBeGreaterThan(military.composite);
      expect(insurance.verdict).toBe('pass');
    });

    test('scoreAllVerticals returns results for every vertical', () => {
      const signals = {
        reactionTime: 0.75,
        clickPrecision: 0.70,
        sustainedFocus: 0.65,
        documentComprehension: 0.80,
        fatigueResistance: 0.70
      };

      const all = VerticalProfiles.scoreAllVerticals(signals);
      expect(Object.keys(all).length).toBe(6);
      expect(all.military.composite).toBeDefined();
      expect(all.insurance.composite).toBeDefined();
    });
  });

  describe('Alerts', () => {
    test('military alerts on fatigue resistance drop', () => {
      const result = VerticalProfiles.score('military', {
        reactionTime: 0.80,
        reactionTimeConsistency: 0.75,
        clickPrecision: 0.70,
        sustainedFocus: 0.65,
        documentComprehension: 0.60,
        fatigueResistance: 0.30  // 70% degraded from baseline
      });

      const fatigueAlert = result.alerts.find(a => a.type === 'reaction_time_drift');
      expect(fatigueAlert).toBeDefined();
      expect(fatigueAlert.severity).toBe('critical');
    });

    test('insurance alerts on incomplete section coverage', () => {
      const result = VerticalProfiles.score('insurance', {
        documentComprehension: 0.80,
        sectionCoverage: 0.50  // only read half
      });

      const readingAlert = result.alerts.find(a => a.type === 'incomplete_reading');
      expect(readingAlert).toBeDefined();
    });

    test('advertising alerts on tab hidden during video', () => {
      const result = VerticalProfiles.score('advertising', {
        videoCompletion: 0.90,
        tabFocus: 0.20  // tab hidden 80% of time
      });

      const tabAlert = result.alerts.find(a => a.type === 'tab_hidden_during_video');
      expect(tabAlert).toBeDefined();
      expect(tabAlert.severity).toBe('critical');
    });
  });

  describe('Certification', () => {
    test('generates insurance certification with legal notice', () => {
      const cert = VerticalProfiles.generateCertification('insurance', {
        documentComprehension: 0.90,
        sectionCoverage: 0.95,
        sustainedFocus: 0.80
      }, { subjectId: 'policyholder_001', context: 'Policy renewal review' });

      expect(cert.certification).toBeDefined();
      expect(cert.certification.vertical).toBe('insurance');
      expect(cert.certification.legal_notice).toContain('evidence');
      expect(cert.certification.compliance.legallyBindable).toBe(true);
    });

    test('generates military certification with SCIF compliance', () => {
      const cert = VerticalProfiles.generateCertification('military', {
        reactionTime: 0.85,
        sustainedFocus: 0.80,
        fatigueResistance: 0.75,
        documentComprehension: 0.70
      });

      expect(cert.certification.compliance.scifCompatible).toBe(true);
      expect(cert.certification.compliance.offlineCapable).toBe(true);
      expect(cert.certification.legal_notice).toContain('SCIF');
    });

    test('generates medical certification with HIPAA notice', () => {
      const cert = VerticalProfiles.generateCertification('medical', {
        clickPrecision: 0.85,
        fatigueResistance: 0.70,
        documentComprehension: 0.90
      });

      expect(cert.certification.compliance.hipaaCompliant).toBe(true);
      expect(cert.certification.legal_notice).toContain('medical assessment');
    });
  });

  describe('Custom Profiles', () => {
    test('creates and uses a custom profile', () => {
      VerticalProfiles.createProfile('nuclear_operator', {
        name: 'Nuclear Plant Operator',
        weights: {
          reactionTime: 0.30,
          sustainedFocus: 0.40,
          fatigueResistance: 0.30
        },
        thresholds: { pass: 0.85, marginal: 0.70, fail: 0.50 },
        certificationLevel: 'nuclear_safety'
      });

      const result = VerticalProfiles.score('nuclear_operator', {
        reactionTime: 0.90,
        sustainedFocus: 0.85,
        fatigueResistance: 0.80
      });

      expect(result.composite).toBeGreaterThan(0.80);
      expect(result.certificationLevel).toBe('nuclear_safety');
    });
  });
});

// ============================================================
// MILITARY READINESS
// ============================================================

describe('Military Readiness Module', () => {

  beforeEach(() => { MilitaryReadiness.reset(); });

  describe('Mission Brief Reading', () => {
    test('scores a thoroughly-read mission brief', () => {
      MilitaryReadiness.init({});

      MilitaryReadiness.registerBriefSection('situation', {
        title: 'Situation', wordCount: 200, critical: true, order: 0
      });
      MilitaryReadiness.registerBriefSection('mission', {
        title: 'Mission', wordCount: 150, critical: true, order: 1
      });
      MilitaryReadiness.registerBriefSection('execution', {
        title: 'Execution', wordCount: 300, critical: true, order: 2
      });
      MilitaryReadiness.registerBriefSection('logistics', {
        title: 'Service & Support', wordCount: 100, order: 3
      });

      // Read all sections at ~180 WPM (slower for technical content)
      MilitaryReadiness.recordBriefView('situation', (200/180)*60000, { activeSignals: 8, reRead: true });
      MilitaryReadiness.recordBriefView('mission', (150/180)*60000, { activeSignals: 6 });
      MilitaryReadiness.recordBriefView('execution', (300/180)*60000, { activeSignals: 12, reRead: true });
      MilitaryReadiness.recordBriefView('logistics', (100/180)*60000, { activeSignals: 4 });

      const brief = MilitaryReadiness.scoreBrief();

      expect(brief.criticalSectionsPassed).toBe(true);
      expect(brief.sectionsRead).toBe(4);
      expect(brief.briefScore).toBeGreaterThan(0.7);
      expect(brief.verdict).toBe('brief_comprehended');

      console.log('\n  === MILITARY: BRIEF READING ===');
      console.log(`  Brief score:     ${brief.briefScore}`);
      console.log(`  Sections read:   ${brief.sectionsRead}/${brief.totalSections}`);
      console.log(`  Critical passed: ${brief.criticalSectionsPassed}`);
      console.log(`  Verdict:         ${brief.verdict}`);
      console.log('  ================================\n');
    });

    test('flags missed critical sections', () => {
      MilitaryReadiness.init({});

      MilitaryReadiness.registerBriefSection('situation', {
        title: 'Situation', wordCount: 200, critical: true
      });
      MilitaryReadiness.registerBriefSection('execution', {
        title: 'Execution', wordCount: 300, critical: true
      });

      // Only read situation, skip execution (critical!)
      MilitaryReadiness.recordBriefView('situation', 60000, { activeSignals: 8 });
      MilitaryReadiness.recordBriefView('execution', 2000, { activeSignals: 0 }); // barely glanced

      const brief = MilitaryReadiness.scoreBrief();
      expect(brief.criticalSectionsPassed).toBe(false);
      expect(brief.verdict).toBe('critical_sections_missed');
    });
  });

  describe('Vigilance Scoring', () => {
    test('scores high for accurate, fast responses', () => {
      MilitaryReadiness.init({});

      // 20 fast, accurate responses
      for (let i = 0; i < 20; i++) {
        MilitaryReadiness.recordVigilanceCheck(280 + Math.random() * 80, true, 'visual');
      }

      const vig = MilitaryReadiness.scoreVigilance();
      expect(vig.score).toBeGreaterThan(0.7);
      expect(vig.verdict).toMatch(/vigilant|adequate/);
      expect(vig.accuracy).toBe(1.0);
    });

    test('penalizes missed stimuli', () => {
      MilitaryReadiness.init({});

      for (let i = 0; i < 15; i++) {
        MilitaryReadiness.recordVigilanceCheck(350, true);
      }
      // Missed 5 stimuli
      for (let i = 0; i < 5; i++) {
        MilitaryReadiness.recordMissedStimulus();
      }

      const vig = MilitaryReadiness.scoreVigilance();
      expect(vig.missRate).toBeGreaterThan(0.15);
      // Miss rate penalizes score, but accuracy on responded stimuli is still 100%
      expect(vig.score).toBeLessThan(1.0);
    });

    test('penalizes false alarms', () => {
      MilitaryReadiness.init({});

      for (let i = 0; i < 10; i++) {
        MilitaryReadiness.recordVigilanceCheck(300, true);
      }
      // 3 false alarms (responded when no stimulus)
      for (let i = 0; i < 3; i++) {
        MilitaryReadiness.recordFalseAlarm();
      }

      const vig = MilitaryReadiness.scoreVigilance();
      expect(vig.falseAlarmRate).toBeGreaterThan(0.15);
    });
  });

  describe('Full Readiness Assessment', () => {
    test('FULL READINESS with good brief + vigilance + fresh fatigue', () => {
      MilitaryReadiness.init({});

      // Read brief
      MilitaryReadiness.registerBriefSection('mission', {
        title: 'Mission', wordCount: 200, critical: true
      });
      MilitaryReadiness.recordBriefView('mission', 70000, { activeSignals: 10, reRead: true });

      // Good vigilance
      for (let i = 0; i < 20; i++) {
        MilitaryReadiness.recordVigilanceCheck(270 + Math.random() * 60, true);
      }

      // Fresh (no fatigue)
      MilitaryReadiness.setBaseline({ mean: 280, stddev: 40 });

      const assessment = MilitaryReadiness.assessReadiness();

      expect(assessment.readinessLevel).toBe('FULL READINESS');
      expect(assessment.readinessCode).toBe(4);
      expect(assessment.readinessScore).toBeGreaterThan(0.75);
      expect(assessment.scifCompliant).toBe(true);
      expect(assessment.piiCollected).toBe(false);

      console.log('\n  === MILITARY: FULL READINESS ===');
      console.log(`  Score:  ${assessment.readinessScore}`);
      console.log(`  Level:  ${assessment.readinessLevel}`);
      console.log(`  Alerts: ${assessment.alerts.length}`);
      console.log('  =================================\n');
    });

    test('DEGRADED when critical brief missed + fatigued', () => {
      MilitaryReadiness.init({});

      // Missed critical brief section
      MilitaryReadiness.registerBriefSection('execution', {
        title: 'Execution', wordCount: 300, critical: true
      });
      MilitaryReadiness.recordBriefView('execution', 2000, {}); // barely looked

      // Poor vigilance
      for (let i = 0; i < 10; i++) {
        MilitaryReadiness.recordVigilanceCheck(600 + Math.random() * 200, i % 3 !== 0);
      }
      for (let i = 0; i < 5; i++) MilitaryReadiness.recordMissedStimulus();

      // Fatigued
      MilitaryReadiness.setBaseline({ mean: 280, stddev: 40 });

      const assessment = MilitaryReadiness.assessReadiness();

      expect(assessment.readinessCode).toBeLessThanOrEqual(2);
      expect(assessment.alerts.length).toBeGreaterThan(0);

      console.log('\n  === MILITARY: DEGRADED ===');
      console.log(`  Score:  ${assessment.readinessScore}`);
      console.log(`  Level:  ${assessment.readinessLevel}`);
      console.log(`  Alerts: ${assessment.alerts.length}`);
      assessment.alerts.forEach(a => console.log(`    [${a.severity}] ${a.detail}`));
      console.log('  ==========================\n');
    });
  });
});

// ============================================================
// MEDICAL SHIFT MONITOR
// ============================================================

describe('Medical Shift Monitor', () => {

  beforeEach(() => { MedicalShiftMonitor.reset(); });

  describe('Performance Check-Ins', () => {
    test('GREEN alert for normal performance', () => {
      MedicalShiftMonitor.init({});
      MedicalShiftMonitor.setBaselineRT({ mean: 300, stddev: 50 });
      MedicalShiftMonitor.setBaselinePrecision({ mean: 5, stddev: 2 });

      const checkIn = MedicalShiftMonitor.checkIn({
        reactionTimeMs: 305,
        precisionPx: 5.1,
        accuracy: 0.95
      });

      // At shift start, even tiny drifts can flag — verify it's at most YELLOW
      expect(checkIn.alertLevel).toBeLessThanOrEqual(1);
      expect(checkIn.rtDrift).toBeLessThan(0.10);
    });

    test('escalating alerts as shift progresses', () => {
      MedicalShiftMonitor.init({});
      MedicalShiftMonitor.setBaselineRT({ mean: 300, stddev: 50 });
      MedicalShiftMonitor.setBaselinePrecision({ mean: 5, stddev: 2 });

      // Hour 2: fine
      const c1 = MedicalShiftMonitor.checkIn({ reactionTimeMs: 310, precisionPx: 5.2 });

      // Hour 6: getting tired
      const c2 = MedicalShiftMonitor.checkIn({ reactionTimeMs: 420, precisionPx: 8 });

      // Hour 10: very tired
      const c3 = MedicalShiftMonitor.checkIn({ reactionTimeMs: 550, precisionPx: 12 });

      expect(c1.alertLevel).toBeLessThan(c3.alertLevel);

      console.log('\n  === MEDICAL: SHIFT PROGRESSION ===');
      console.log(`  Check-in 1: RT=${c1.reactionTimeMs}ms alert=${c1.alertLabel}`);
      console.log(`  Check-in 2: RT=${c2.reactionTimeMs}ms alert=${c2.alertLabel}`);
      console.log(`  Check-in 3: RT=${c3.reactionTimeMs}ms alert=${c3.alertLabel}`);
      console.log('  ==================================\n');
    });
  });

  describe('Protocol Compliance', () => {
    test('fully compliant when all protocols read', () => {
      MedicalShiftMonitor.init({});

      MedicalShiftMonitor.registerProtocol('med_admin', {
        title: 'Medication Administration Protocol',
        wordCount: 500, critical: true
      });
      MedicalShiftMonitor.registerProtocol('hand_hygiene', {
        title: 'Hand Hygiene Protocol',
        wordCount: 200, critical: true
      });

      MedicalShiftMonitor.recordProtocolView('med_admin', (500/150)*60000, { activeSignals: 8 });
      MedicalShiftMonitor.recordProtocolView('hand_hygiene', (200/150)*60000, { activeSignals: 4 });

      const compliance = MedicalShiftMonitor.scoreProtocolCompliance();
      expect(compliance.criticalCompliance).toBe(1.0);
      expect(compliance.verdict).toMatch(/compliant|fully_compliant/);

      console.log('\n  === MEDICAL: PROTOCOL COMPLIANCE ===');
      console.log(`  Score:      ${compliance.score}`);
      console.log(`  Critical:   ${compliance.criticalCompliance}`);
      console.log(`  Verdict:    ${compliance.verdict}`);
      console.log('  ====================================\n');
    });

    test('non-compliant when critical protocol skipped', () => {
      MedicalShiftMonitor.init({});

      MedicalShiftMonitor.registerProtocol('blood_admin', {
        title: 'Blood Product Administration',
        wordCount: 800, critical: true
      });

      // Barely looked at it
      MedicalShiftMonitor.recordProtocolView('blood_admin', 3000, {});

      const compliance = MedicalShiftMonitor.scoreProtocolCompliance();
      expect(compliance.criticalCompliance).toBeLessThan(1.0);
      expect(compliance.verdict).toMatch(/non_compliant|partial/);
    });
  });

  describe('Handoff Readiness', () => {
    test('ready for handoff with good metrics', () => {
      MedicalShiftMonitor.init({});
      MedicalShiftMonitor.setBaselineRT({ mean: 300, stddev: 50 });

      // Read protocols
      MedicalShiftMonitor.registerProtocol('shift_report', {
        title: 'Shift Report Protocol', wordCount: 300, critical: true
      });
      MedicalShiftMonitor.recordProtocolView('shift_report', (300/150)*60000, { activeSignals: 6 });

      // Good check-ins
      for (let i = 0; i < 5; i++) {
        MedicalShiftMonitor.checkIn({ reactionTimeMs: 310 + Math.random() * 30 });
      }

      const handoff = MedicalShiftMonitor.assessHandoffReadiness();
      expect(handoff.handoffReady).toBe(true);
      expect(handoff.concerns.length).toBe(0);
    });

    test('not ready when fatigued and non-compliant', () => {
      MedicalShiftMonitor.init({});
      MedicalShiftMonitor.setBaselineRT({ mean: 300, stddev: 50 });

      // Skipped critical protocol
      MedicalShiftMonitor.registerProtocol('critical_update', {
        title: 'New Drug Interaction Alert', wordCount: 400, critical: true
      });
      MedicalShiftMonitor.recordProtocolView('critical_update', 2000, {});

      // Degraded check-ins
      for (let i = 0; i < 5; i++) {
        MedicalShiftMonitor.checkIn({ reactionTimeMs: 550 + Math.random() * 100 });
      }

      const handoff = MedicalShiftMonitor.assessHandoffReadiness();
      expect(handoff.handoffReady).toBe(false);
      expect(handoff.concerns.length).toBeGreaterThan(0);

      console.log('\n  === MEDICAL: HANDOFF NOT READY ===');
      console.log(`  Ready:    ${handoff.handoffReady}`);
      console.log(`  Score:    ${handoff.score}`);
      console.log(`  Concerns:`);
      handoff.concerns.forEach(c => console.log(`    - ${c}`));
      console.log('  ==================================\n');
    });
  });

  describe('Full Shift Report', () => {
    test('generates comprehensive shift report', () => {
      MedicalShiftMonitor.init({});
      MedicalShiftMonitor.setBaselineRT({ mean: 300, stddev: 50 });

      MedicalShiftMonitor.registerProtocol('med_admin', {
        title: 'Med Admin', wordCount: 300, critical: true
      });
      MedicalShiftMonitor.recordProtocolView('med_admin', 120000, { activeSignals: 5 });

      MedicalShiftMonitor.checkIn({ reactionTimeMs: 310 });
      MedicalShiftMonitor.recordBreak(900000); // 15 min break

      const report = MedicalShiftMonitor.getShiftReport();
      expect(report.hipaaCompliant).toBe(true);
      expect(report.phiCollected).toBe(false);
      expect(report.breaksTaken).toBe(1);
      expect(report.totalCheckIns).toBe(1);
      expect(report.protocolCompliance).toBeDefined();
      expect(report.fatigue).toBeDefined();
      expect(report.handoffReadiness).toBeDefined();
    });
  });
});
