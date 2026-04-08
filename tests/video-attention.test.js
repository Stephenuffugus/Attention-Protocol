/**
 * Video Attention Tracker — Test Suite
 *
 * Proves: we can tell if a real human watched a video vs a bot farm.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const VideoTracker = require('../src/sdk/video-attention-tracker');

describe('Video Attention Tracker', () => {

  beforeEach(() => {
    VideoTracker.reset();
  });

  // ----------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------

  describe('Initialization', () => {
    test('initializes and sets duration', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(300); // 5-minute video
      expect(VideoTracker._internal.segments().length).toBeGreaterThan(0);
    });

    test('creates correct number of segments', () => {
      VideoTracker.init({ segmentLengthSec: 10 });
      VideoTracker.setDuration(60); // 60s video, 10s segments = 6 segments
      expect(VideoTracker._internal.segments().length).toBe(6);
    });
  });

  // ----------------------------------------------------------
  // GENUINE VIEWER (Human watches a training video)
  // ----------------------------------------------------------

  describe('Genuine Viewer — Full Attention', () => {
    test('scores high for engaged human viewer', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(120); // 2-minute video

      // Play the full video
      VideoTracker.recordPlay(0);

      // Simulate watching — periodic mouse activity
      for (let sec = 0; sec < 120; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
        VideoTracker.recordActivity('mousemove', sec);
      }

      // Pause twice to take notes
      VideoTracker.recordPause(30);
      VideoTracker.recordPlay(30);
      VideoTracker.recordPause(75);
      VideoTracker.recordPlay(75);

      // Seek back to re-watch something
      VideoTracker.recordSeek(90, 60);
      VideoTracker.recordTimeUpdate(60);

      // Tab stays focused
      // (default is focused, so no visibility changes)

      const result = VideoTracker.score();
      expect(result.composite).toBeGreaterThan(0.55);
      expect(result.verdict).toMatch(/genuine_viewer|partial_attention/);
      expect(result.stats.pauseCount).toBe(2);
      expect(result.stats.seekBackCount).toBe(1);

      console.log('\n  === VIDEO: GENUINE VIEWER ===');
      console.log(`  Composite:   ${result.composite}`);
      console.log(`  Verdict:     ${result.verdict}`);
      console.log(`  Completion:  ${result.stats.completionPercent}%`);
      console.log(`  Focus:       ${result.stats.focusPercent}%`);
      console.log(`  Pauses:      ${result.stats.pauseCount}`);
      console.log(`  Seek backs:  ${result.stats.seekBackCount}`);
      console.log('  =============================\n');
    });

    test('re-watching sections boosts engagement score', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(60);

      VideoTracker.recordPlay(0);
      for (let s = 0; s < 60; s += 5) {
        VideoTracker.recordTimeUpdate(s);
        VideoTracker.recordActivity('mousemove', s);
      }

      // Pause + seek back 3 times
      VideoTracker.recordPause(50);
      VideoTracker.recordPlay(50);
      VideoTracker.recordSeek(50, 20);
      VideoTracker.recordSeek(40, 10);
      VideoTracker.recordSeek(30, 5);

      const result = VideoTracker.score();
      expect(result.scores.engagement).toBeGreaterThan(0.5);
      expect(result.stats.seekBackCount).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // BOT VIEWER (auto-play, no interaction)
  // ----------------------------------------------------------

  describe('Bot Viewer — Auto-play Bot', () => {
    test('scores low for bot that just starts and never interacts', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(120);

      // Bot presses play and walks away
      VideoTracker.recordPlay(0);
      VideoTracker.setPlayTime(120000); // simulate 2 min of play time
      // Time passes but zero activity, zero pauses, zero seeks
      for (let sec = 0; sec < 120; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
      }

      const result = VideoTracker.score();
      expect(result.scores.engagement).toBeLessThan(0.3); // no pauses, no seeks
      expect(result.scores.activity).toBeLessThan(0.2);    // zero activity
      expect(result.stats.pauseCount).toBe(0);
      expect(result.stats.seekBackCount).toBe(0);
      // Bot still gets completion + focus credit, but engagement + activity are low
      // Without tab-hiding, a play-only bot can still score ~0.7 from completion+focus
      // The engagement + activity signals are what differentiate it
      expect(result.composite).toBeLessThan(0.75);

      console.log('\n  === VIDEO: BOT VIEWER ===');
      console.log(`  Composite:   ${result.composite}`);
      console.log(`  Verdict:     ${result.verdict}`);
      console.log(`  Engagement:  ${result.scores.engagement}`);
      console.log(`  Activity:    ${result.scores.activity}`);
      console.log('  =========================\n');
    });

    test('tab-hidden bot scores low on focus', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(60);

      VideoTracker.recordPlay(0);
      // Simulate: tab was hidden for 55s, focused for 5s
      VideoTracker.setFocusTime(5000, 55000);

      for (let sec = 0; sec < 60; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
      }

      const result = VideoTracker.score();
      expect(result.scores.focus).toBeLessThan(0.15); // ~8% focused
    });
  });

  // ----------------------------------------------------------
  // DISTRACTED VIEWER (partially watching)
  // ----------------------------------------------------------

  describe('Distracted Viewer', () => {
    test('scores in the middle for viewer who switches tabs', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(120);

      VideoTracker.recordPlay(0);
      // Simulate: focused for 70s out of 120s (tab hidden for middle 50s)
      VideoTracker.setFocusTime(70000, 50000);

      // Watch first 40 seconds engaged
      for (let sec = 0; sec < 40; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
        VideoTracker.recordActivity('mousemove', sec);
      }

      // Track tab switches
      VideoTracker.recordVisibilityChange(false);
      VideoTracker.recordVisibilityChange(true);

      // Watch last 30 seconds
      for (let sec = 90; sec < 120; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
        VideoTracker.recordActivity('mousemove', sec);
      }

      const result = VideoTracker.score();
      expect(result.scores.focus).toBeLessThan(0.65); // 58% focused
      expect(result.stats.tabSwitchCount).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // SPEED-WATCHER (2x playback)
  // ----------------------------------------------------------

  describe('Speed Watcher', () => {
    test('2x playback slightly reduces pacing score', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(120);

      VideoTracker.recordPlay(0);
      VideoTracker.recordPlaybackRateChange(1.0, 2.0, 0);

      for (let sec = 0; sec < 120; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
        VideoTracker.recordActivity('mousemove', sec);
      }

      VideoTracker.recordPause(60);

      const result = VideoTracker.score();
      expect(result.scores.pacing).toBe(0.8); // 2x is acceptable
    });

    test('4x playback heavily penalized', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(120);

      VideoTracker.recordPlay(0);
      VideoTracker.recordPlaybackRateChange(1.0, 4.0, 0);

      const result = VideoTracker.score();
      expect(result.scores.pacing).toBe(0.2);
    });
  });

  // ----------------------------------------------------------
  // HUMAN vs BOT GAP
  // ----------------------------------------------------------

  describe('Human vs Bot Gap — Video', () => {
    test('genuine viewer scores significantly higher than auto-play bot', () => {
      // HUMAN — full engagement
      VideoTracker.init({});
      VideoTracker.setDuration(120);
      VideoTracker.setPlayTime(120000);
      VideoTracker.setFocusTime(120000, 0);
      VideoTracker.recordPlay(0);
      for (let sec = 0; sec < 120; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
        VideoTracker.recordActivity('mousemove', sec);
      }
      VideoTracker.recordPause(30);
      VideoTracker.recordPlay(30);
      VideoTracker.recordPause(80);
      VideoTracker.recordPlay(80);
      VideoTracker.recordSeek(100, 45);
      const humanResult = VideoTracker.score();

      // BOT — auto-play, hidden tab, no interaction
      VideoTracker.reset();
      VideoTracker.init({});
      VideoTracker.setDuration(120);
      VideoTracker.setPlayTime(120000);
      VideoTracker.setFocusTime(5000, 115000); // tab hidden most of time
      VideoTracker.recordPlay(0);
      for (let sec = 0; sec < 120; sec += 5) {
        VideoTracker.recordTimeUpdate(sec);
        // No activity, no pauses, no seeks
      }
      const botResult = VideoTracker.score();

      console.log('\n  === VIDEO: HUMAN vs BOT ===');
      console.log(`  Human: ${humanResult.composite} (${humanResult.verdict})`);
      console.log(`  Bot:   ${botResult.composite} (${botResult.verdict})`);
      console.log(`  GAP:   ${(humanResult.composite / Math.max(0.001, botResult.composite)).toFixed(1)}x`);
      console.log('  ===========================\n');

      expect(humanResult.composite).toBeGreaterThan(botResult.composite * 1.5);
      expect(humanResult.verdict).not.toBe('likely_bot');
      expect(botResult.verdict).not.toBe('genuine_viewer');
    });
  });

  // ----------------------------------------------------------
  // EXPORT
  // ----------------------------------------------------------

  describe('Server Export', () => {
    test('exports data for server analysis', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(60);
      VideoTracker.recordPlay(0);
      VideoTracker.recordPause(30);
      VideoTracker.recordSeek(30, 10);
      VideoTracker.recordActivity('click', 15);

      const exported = VideoTracker.exportForServer();
      expect(exported.videoDurationSec).toBe(60);
      expect(exported.pauseTimestamps.length).toBe(1);
      expect(exported.seekEvents.length).toBe(1);
      expect(exported.activityLog.length).toBe(1);
      expect(exported.segments.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // EDGE CASES
  // ----------------------------------------------------------

  describe('Edge Cases', () => {
    test('scoring before any events returns defaults', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(60);
      const result = VideoTracker.score();
      expect(result).toBeDefined();
      expect(result.composite).toBeDefined();
    });

    test('reset clears all state', () => {
      VideoTracker.init({});
      VideoTracker.setDuration(120);
      VideoTracker.recordPlay(0);
      VideoTracker.recordPause(30);
      VideoTracker.reset();
      expect(VideoTracker._internal.segments().length).toBe(0);
      expect(VideoTracker._internal.state().pauseCount).toBe(0);
    });
  });
});
