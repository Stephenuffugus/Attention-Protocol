/**
 * SWS Video Attention Tracker
 *
 * Tracks genuine human attention during video playback.
 * Answers the question: "Is a real person watching this video?"
 *
 * Use cases:
 *   - Ad verification (is a human watching this ad or a bot farm?)
 *   - Training video completion proof (did the employee actually watch?)
 *   - Content engagement scoring (how engaged was the viewer?)
 *   - CPM fraud detection (are these real video views?)
 *
 * Signals tracked:
 *   - Play/pause patterns (humans pause at interesting/confusing parts)
 *   - Seek behavior (humans seek back to re-watch, bots don't)
 *   - Tab focus during playback (tab hidden = not watching)
 *   - Mouse/touch activity during playback (humans fidget, bots don't)
 *   - Completion segments (which parts of the video were actually viewed)
 *   - Buffer/stall reactions (humans wait or seek past; bots don't react)
 *   - Playback speed changes (humans sometimes speed up/slow down)
 *   - Interaction timing relative to video events (humans react to content)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var DEFAULT_CONFIG = {
    // Minimum watch percentage to count as "viewed"
    minWatchPercent: 0.80,
    // Minimum focus percentage during playback
    minFocusPercent: 0.70,
    // Expected mouse/touch events per minute of video for a human
    humanActivityPerMinute: 3,
    // Maximum gap between activity signals before flagging inattention (ms)
    inattentionGapMs: 60000,
    // Segment granularity for coverage tracking (seconds)
    segmentLengthSec: 5,
    debug: false
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _initialized = false;
  var _videoElement = null;
  var _videoDurationSec = 0;

  // Playback state
  var _isPlaying = false;
  var _playStartTime = 0;       // timestamp when play began
  var _totalPlayTimeMs = 0;     // accumulated real play time
  var _totalPausedTimeMs = 0;   // accumulated paused time
  var _pauseCount = 0;
  var _pauseTimestamps = [];    // [{videoTime, wallTime}, ...]
  var _playbackRateChanges = []; // [{from, to, videoTime, wallTime}, ...]
  var _currentPlaybackRate = 1.0;

  // Seek behavior
  var _seekEvents = [];         // [{from, to, wallTime}, ...]
  var _seekBackCount = 0;       // seeks backward (re-watching)
  var _seekForwardCount = 0;    // seeks forward (skipping)

  // Tab focus tracking
  var _tabFocusedMs = 0;
  var _tabHiddenMs = 0;
  var _tabFocusStart = 0;
  var _tabHiddenStart = 0;
  var _tabSwitchCount = 0;
  var _isTabFocused = true;

  // Activity during playback
  var _activityLog = [];        // [{type, wallTime, videoTime}, ...]
  var _activityDuringPlay = 0;  // count of mouse/touch/key events while video playing
  var _inattentionGaps = [];    // periods with no activity while playing

  // Segment coverage (which parts of the video were watched)
  var _segments = [];           // [{startSec, endSec, watched: bool, focusedMs, activityCount}, ...]
  var _currentSegmentIndex = -1;

  // Buffer/stall tracking
  var _bufferEvents = [];       // [{startTime, endTime, duration}, ...]
  var _totalBufferMs = 0;

  // Session
  var _sessionStart = 0;

  // ============================================================
  // UTILITY
  // ============================================================

  function _log() {
    if (_config.debug) {
      var args = ['[SWS Video]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  function _now() {
    return Date.now();
  }

  // ============================================================
  // SEGMENT COVERAGE
  // ============================================================

  function _initSegments(durationSec) {
    _segments = [];
    var segLen = _config.segmentLengthSec;
    for (var i = 0; i < durationSec; i += segLen) {
      _segments.push({
        startSec: i,
        endSec: Math.min(i + segLen, durationSec),
        watched: false,
        watchedMs: 0,
        focusedMs: 0,
        activityCount: 0,
        lastUpdateTime: null
      });
    }
    _log('Initialized', _segments.length, 'segments for', durationSec, 'sec video');
  }

  function _getSegmentIndex(videoTimeSec) {
    if (_segments.length === 0) return -1;
    var idx = Math.floor(videoTimeSec / _config.segmentLengthSec);
    return Math.min(idx, _segments.length - 1);
  }

  function _updateCurrentSegment(videoTimeSec) {
    var idx = _getSegmentIndex(videoTimeSec);
    if (idx < 0 || idx >= _segments.length) return;

    var segment = _segments[idx];
    var now = _now();

    if (_currentSegmentIndex === idx && segment.lastUpdateTime) {
      var elapsed = now - segment.lastUpdateTime;
      segment.watchedMs += elapsed;
      if (_isTabFocused) {
        segment.focusedMs += elapsed;
      }
    }

    segment.watched = true;
    segment.lastUpdateTime = now;
    _currentSegmentIndex = idx;
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  var VideoTracker = {
    /**
     * Initialize the video tracker.
     */
    init: function(config) {
      _config = {};
      for (var key in DEFAULT_CONFIG) {
        if (DEFAULT_CONFIG.hasOwnProperty(key)) {
          _config[key] = (config && config[key] !== undefined) ? config[key] : DEFAULT_CONFIG[key];
        }
      }
      _sessionStart = _now();
      _initialized = true;
      this._resetState();
      _log('Initialized');
    },

    _resetState: function() {
      _isPlaying = false;
      _playStartTime = 0;
      _totalPlayTimeMs = 0;
      _totalPausedTimeMs = 0;
      _pauseCount = 0;
      _pauseTimestamps = [];
      _playbackRateChanges = [];
      _currentPlaybackRate = 1.0;
      _seekEvents = [];
      _seekBackCount = 0;
      _seekForwardCount = 0;
      _tabFocusedMs = 0;
      _tabHiddenMs = 0;
      _tabFocusStart = _now();
      _tabHiddenStart = 0;
      _tabSwitchCount = 0;
      _isTabFocused = true;
      _activityLog = [];
      _activityDuringPlay = 0;
      _inattentionGaps = [];
      _segments = [];
      _currentSegmentIndex = -1;
      _bufferEvents = [];
      _totalBufferMs = 0;
    },

    /**
     * Set the video duration and initialize segments.
     * Call this when video metadata is loaded.
     */
    setDuration: function(durationSec) {
      _videoDurationSec = durationSec;
      _initSegments(durationSec);
    },

    /**
     * Record a play event.
     */
    recordPlay: function(videoTimeSec) {
      if (!_initialized) return;
      var now = _now();

      if (!_isPlaying) {
        _isPlaying = true;
        _playStartTime = now;

        // If was paused, record pause duration
        if (_pauseTimestamps.length > 0) {
          var lastPause = _pauseTimestamps[_pauseTimestamps.length - 1];
          if (!lastPause.resumeTime) {
            lastPause.resumeTime = now;
            lastPause.pauseDuration = now - lastPause.wallTime;
            _totalPausedTimeMs += lastPause.pauseDuration;
          }
        }
      }

      _updateCurrentSegment(videoTimeSec || 0);
      _log('Play at', videoTimeSec, 'sec');
    },

    /**
     * Record a pause event.
     */
    recordPause: function(videoTimeSec) {
      if (!_initialized) return;
      var now = _now();

      if (_isPlaying) {
        _totalPlayTimeMs += now - _playStartTime;
        _isPlaying = false;
        _pauseCount++;
        _pauseTimestamps.push({
          videoTime: videoTimeSec || 0,
          wallTime: now,
          resumeTime: null,
          pauseDuration: null
        });
      }

      _updateCurrentSegment(videoTimeSec || 0);
      _log('Pause at', videoTimeSec, 'sec (count:', _pauseCount, ')');
    },

    /**
     * Record a seek event.
     */
    recordSeek: function(fromSec, toSec) {
      if (!_initialized) return;

      _seekEvents.push({
        from: fromSec,
        to: toSec,
        wallTime: _now(),
        direction: toSec > fromSec ? 'forward' : 'backward',
        distance: Math.abs(toSec - fromSec)
      });

      if (toSec < fromSec) {
        _seekBackCount++;
      } else {
        _seekForwardCount++;
      }

      if (_seekEvents.length > 500) _seekEvents.shift();
      _updateCurrentSegment(toSec);
      _log('Seek:', fromSec, '->', toSec);
    },

    /**
     * Record a timeupdate event (called periodically during playback).
     */
    recordTimeUpdate: function(videoTimeSec) {
      if (!_initialized) return;
      _updateCurrentSegment(videoTimeSec);
    },

    /**
     * Record tab visibility change.
     */
    recordVisibilityChange: function(isVisible) {
      if (!_initialized) return;
      var now = _now();

      if (isVisible && !_isTabFocused) {
        // Tab became visible
        _isTabFocused = true;
        _tabFocusStart = now;
        if (_tabHiddenStart > 0) {
          _tabHiddenMs += now - _tabHiddenStart;
          _tabHiddenStart = 0;
        }
        _tabSwitchCount++;
      } else if (!isVisible && _isTabFocused) {
        // Tab became hidden
        _isTabFocused = false;
        _tabHiddenStart = now;
        if (_tabFocusStart > 0) {
          _tabFocusedMs += now - _tabFocusStart;
          _tabFocusStart = 0;
        }
        _tabSwitchCount++;
      }

      _log('Visibility:', isVisible ? 'visible' : 'hidden');
    },

    /**
     * Record user activity during playback (mouse, touch, key).
     */
    recordActivity: function(type, videoTimeSec) {
      if (!_initialized) return;

      _activityLog.push({
        type: type || 'unknown',
        wallTime: _now(),
        videoTime: videoTimeSec || 0
      });

      if (_isPlaying) {
        _activityDuringPlay++;

        // Update segment activity
        var idx = _getSegmentIndex(videoTimeSec || 0);
        if (idx >= 0 && idx < _segments.length) {
          _segments[idx].activityCount++;
        }
      }

      if (_activityLog.length > 2000) _activityLog.shift();
    },

    /**
     * Record a buffer/stall event.
     */
    recordBuffer: function(startTime, endTime) {
      if (!_initialized) return;
      var duration = (endTime || _now()) - (startTime || _now());
      _bufferEvents.push({ startTime: startTime, endTime: endTime, duration: duration });
      _totalBufferMs += duration;
      if (_bufferEvents.length > 100) _bufferEvents.shift();
    },

    /**
     * Record playback rate change.
     */
    recordPlaybackRateChange: function(fromRate, toRate, videoTimeSec) {
      if (!_initialized) return;
      _playbackRateChanges.push({
        from: fromRate,
        to: toRate,
        videoTime: videoTimeSec || 0,
        wallTime: _now()
      });
      _currentPlaybackRate = toRate;
      if (_playbackRateChanges.length > 100) _playbackRateChanges.shift();
    },

    // ============================================================
    // SCORING ENGINE
    // ============================================================

    /**
     * Score the video attention session.
     * Returns comprehensive attention analysis.
     */
    score: function() {
      var now = _now();

      // Finalize timers
      if (_isPlaying && _playStartTime > 0) {
        _totalPlayTimeMs += now - _playStartTime;
        _playStartTime = now;
      }
      if (_isTabFocused && _tabFocusStart > 0) {
        _tabFocusedMs += now - _tabFocusStart;
        _tabFocusStart = now;
      }
      if (!_isTabFocused && _tabHiddenStart > 0) {
        _tabHiddenMs += now - _tabHiddenStart;
        _tabHiddenStart = now;
      }

      var totalSessionMs = now - _sessionStart;
      var videoDurationMs = _videoDurationSec * 1000;
      var scores = {};

      // 1. Completion Score — what % of segments were watched?
      var watchedSegments = 0;
      _segments.forEach(function(seg) {
        if (seg.watched) watchedSegments++;
      });
      var completionRatio = _segments.length > 0 ? watchedSegments / _segments.length : 0;
      scores.completion = completionRatio;

      // 2. Focus Score — what % of playback time was tab focused?
      var totalTrackableMs = _tabFocusedMs + _tabHiddenMs;
      var focusRatio = totalTrackableMs > 0 ? _tabFocusedMs / totalTrackableMs : 1;
      scores.focus = focusRatio;

      // 3. Engagement Score — pause/seek behavior
      // Humans pause and seek back; bots just let it run
      var pauseScore = 0;
      if (_pauseCount >= 3) pauseScore = 1.0;       // multiple pauses = engaged
      else if (_pauseCount >= 1) pauseScore = 0.6;   // at least one pause
      else pauseScore = 0.2;                          // no pauses = suspicious

      var seekScore = 0;
      if (_seekBackCount >= 2) seekScore = 1.0;       // re-watching parts = very engaged
      else if (_seekBackCount >= 1) seekScore = 0.7;
      else if (_seekForwardCount > 0) seekScore = 0.3; // only forward = skipping
      else seekScore = 0.2;                            // no seeks at all = suspicious

      scores.engagement = pauseScore * 0.5 + seekScore * 0.5;

      // 4. Activity Score — mouse/touch/key events during playback
      var playMinutes = _totalPlayTimeMs / 60000;
      var expectedActivity = playMinutes * _config.humanActivityPerMinute;
      if (expectedActivity > 0 && _activityDuringPlay >= expectedActivity * 0.5) {
        scores.activity = Math.min(1, _activityDuringPlay / expectedActivity);
      } else if (_activityDuringPlay > 0) {
        scores.activity = 0.3 + 0.3 * (_activityDuringPlay / Math.max(1, expectedActivity));
      } else {
        scores.activity = 0.1; // zero activity = bot-like
      }
      scores.activity = Math.min(1, Math.max(0, scores.activity));

      // 5. Pacing Score — did they watch at normal speed?
      var paceScore = 1.0;
      if (_playbackRateChanges.length > 0) {
        // Some rate changes are human (speeding up boring parts)
        var maxRate = _currentPlaybackRate;
        _playbackRateChanges.forEach(function(r) {
          if (r.to > maxRate) maxRate = r.to;
        });
        if (maxRate <= 2.0) paceScore = 0.8;         // up to 2x is normal
        else if (maxRate <= 3.0) paceScore = 0.5;     // 3x = rushing
        else paceScore = 0.2;                          // >3x = not really watching
      }
      scores.pacing = paceScore;

      // 6. Inattention Gap Score — long periods without any activity during play
      var gapCount = 0;
      if (_activityLog.length >= 2) {
        var playActivityLog = _activityLog.filter(function(a) { return true; }); // all activity
        for (var i = 1; i < playActivityLog.length; i++) {
          var gap = playActivityLog[i].wallTime - playActivityLog[i - 1].wallTime;
          if (gap > _config.inattentionGapMs) {
            gapCount++;
          }
        }
      }
      if (gapCount === 0) {
        scores.attentionContinuity = 1.0;
      } else if (gapCount <= 2) {
        scores.attentionContinuity = 0.6;
      } else {
        scores.attentionContinuity = Math.max(0.1, 1 - gapCount * 0.15);
      }

      // Composite score
      var composite = (
        scores.completion * 0.25 +
        scores.focus * 0.20 +
        scores.engagement * 0.15 +
        scores.activity * 0.20 +
        scores.pacing * 0.10 +
        scores.attentionContinuity * 0.10
      );

      var verdict;
      if (composite >= 0.70) verdict = 'genuine_viewer';
      else if (composite >= 0.50) verdict = 'partial_attention';
      else if (composite >= 0.30) verdict = 'minimal_attention';
      else verdict = 'likely_bot';

      return {
        composite: Math.round(composite * 1000) / 1000,
        verdict: verdict,
        scores: {
          completion: Math.round(scores.completion * 1000) / 1000,
          focus: Math.round(scores.focus * 1000) / 1000,
          engagement: Math.round(scores.engagement * 1000) / 1000,
          activity: Math.round(scores.activity * 1000) / 1000,
          pacing: Math.round(scores.pacing * 1000) / 1000,
          attentionContinuity: Math.round(scores.attentionContinuity * 1000) / 1000
        },
        stats: {
          videoDurationSec: _videoDurationSec,
          totalPlayTimeMs: Math.round(_totalPlayTimeMs),
          totalPausedTimeMs: Math.round(_totalPausedTimeMs),
          pauseCount: _pauseCount,
          seekBackCount: _seekBackCount,
          seekForwardCount: _seekForwardCount,
          tabFocusedMs: Math.round(_tabFocusedMs),
          tabHiddenMs: Math.round(_tabHiddenMs),
          tabSwitchCount: _tabSwitchCount,
          activityDuringPlay: _activityDuringPlay,
          segmentsWatched: watchedSegments,
          segmentsTotal: _segments.length,
          completionPercent: Math.round(completionRatio * 100),
          focusPercent: Math.round(focusRatio * 100),
          bufferCount: _bufferEvents.length,
          totalBufferMs: Math.round(_totalBufferMs),
          playbackRateChanges: _playbackRateChanges.length,
          currentPlaybackRate: _currentPlaybackRate
        },
        segments: _segments.map(function(seg) {
          return {
            startSec: seg.startSec,
            endSec: seg.endSec,
            watched: seg.watched,
            activityCount: seg.activityCount
          };
        })
      };
    },

    /**
     * Export data for server-side analysis.
     */
    exportForServer: function() {
      return {
        videoDurationSec: _videoDurationSec,
        totalPlayTimeMs: _totalPlayTimeMs,
        pauseTimestamps: _pauseTimestamps.slice(-50),
        seekEvents: _seekEvents.slice(-50),
        activityLog: _activityLog.slice(-200),
        bufferEvents: _bufferEvents.slice(-20),
        playbackRateChanges: _playbackRateChanges.slice(-20),
        tabFocusedMs: _tabFocusedMs,
        tabHiddenMs: _tabHiddenMs,
        tabSwitchCount: _tabSwitchCount,
        segments: _segments.map(function(seg) {
          return {
            startSec: seg.startSec,
            endSec: seg.endSec,
            watched: seg.watched,
            watchedMs: seg.watchedMs,
            focusedMs: seg.focusedMs,
            activityCount: seg.activityCount
          };
        })
      };
    },

    /**
     * Reset all state.
     */
    reset: function() {
      this._resetState();
      _videoDurationSec = 0;
      _initialized = false;
    },

    /**
     * Directly set focus/hidden time (for testing, since timestamps
     * don't accumulate meaningful time in unit tests).
     */
    setFocusTime: function(focusedMs, hiddenMs) {
      _tabFocusedMs = focusedMs;
      _tabHiddenMs = hiddenMs;
      _tabFocusStart = 0; // prevent further accumulation in score()
    },

    /**
     * Directly set play time (for testing).
     */
    setPlayTime: function(playTimeMs) {
      _totalPlayTimeMs = playTimeMs;
      _playStartTime = 0; // prevent further accumulation in score()
    },

    // Expose for testing
    _internal: {
      config: function() { return _config; },
      segments: function() { return _segments; },
      state: function() {
        return {
          isPlaying: _isPlaying,
          totalPlayTimeMs: _totalPlayTimeMs,
          pauseCount: _pauseCount,
          seekBackCount: _seekBackCount,
          seekForwardCount: _seekForwardCount,
          activityDuringPlay: _activityDuringPlay,
          tabFocusedMs: _tabFocusedMs,
          tabHiddenMs: _tabHiddenMs
        };
      }
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoTracker;
  } else if (typeof root !== 'undefined') {
    root.SWSVideoTracker = VideoTracker;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
