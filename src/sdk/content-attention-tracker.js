/**
 * SWS Content Section Attention Tracker
 *
 * Tracks per-section attention signals for content verification.
 * Answers the question: "Did this person actually READ this content?"
 *
 * Use cases:
 *   - Policy read verification (insurance, HR, legal compliance)
 *   - Training material completion proof
 *   - Terms of service genuine engagement
 *   - Survey/form attention quality
 *
 * Signals tracked per section:
 *   - Dwell time (how long the section was in viewport)
 *   - Scroll velocity through section (speed-reading vs genuine reading)
 *   - Re-reads (section re-entered viewport after leaving)
 *   - Viewport coverage (what % of the section was actually visible)
 *   - Active interaction during viewing (mouse moves, highlights, clicks)
 *   - Reading pace consistency (words per minute stability)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var DEFAULT_CONFIG = {
    // Minimum time in viewport to count as "viewed" (ms)
    minViewTimeMs: 1000,
    // Minimum viewport intersection ratio to count as "visible"
    minIntersectionRatio: 0.5,
    // Expected reading speed range (words per minute)
    humanReadingWpmMin: 100,
    humanReadingWpmMax: 400,
    // Speed-reading / skimming threshold (words per minute)
    skimmingWpmThreshold: 600,
    // Minimum mouse/touch events during viewing to count as "active"
    minActiveSignals: 2,
    // Polling interval for dwell time accumulation (ms)
    dwellPollMs: 250,
    // Section selector (CSS selector for content sections)
    sectionSelector: '[data-sws-section]',
    // Debug mode
    debug: false
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _sections = {};       // sectionId -> section tracking data
  var _activeSections = {}; // sectionId -> true (currently in viewport)
  var _observer = null;     // IntersectionObserver instance
  var _dwellTimer = null;
  var _initialized = false;
  var _documentWordCount = 0;
  var _mouseMoveDuringView = {};  // sectionId -> count of mouse events while visible
  var _startTime = 0;

  // ============================================================
  // UTILITY
  // ============================================================

  function _log() {
    if (_config.debug) {
      var args = ['[SWS Content Tracker]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  function _countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
  }

  function _now() {
    return Date.now();
  }

  // ============================================================
  // SECTION REGISTRATION & TRACKING
  // ============================================================

  /**
   * Register a content section for tracking.
   * @param {string} sectionId - Unique ID for this section
   * @param {object} meta - { element, wordCount, title, order }
   */
  function _registerSection(sectionId, meta) {
    if (_sections[sectionId]) return; // already registered

    var wordCount = meta.wordCount || 0;
    if (meta.element && !wordCount) {
      wordCount = _countWords(meta.element.textContent || meta.element.innerText);
    }

    _sections[sectionId] = {
      id: sectionId,
      title: meta.title || sectionId,
      order: meta.order || 0,
      wordCount: wordCount,

      // Dwell tracking
      totalDwellMs: 0,
      viewEntries: 0,        // number of times section entered viewport
      lastEntryTime: null,
      isVisible: false,

      // Re-read detection
      reReadCount: 0,         // times section was re-entered after fully leaving
      hasBeenRead: false,     // set to true after first sufficient dwell

      // Viewport coverage
      maxIntersectionRatio: 0,
      intersectionSamples: [],

      // Active engagement during viewing
      activeSignals: 0,       // mouse moves, clicks, highlights while section visible
      clicksDuringView: 0,
      textSelections: 0,

      // Scroll velocity through section
      scrollVelocities: [],   // px/ms when section was transitioning

      // Reading pace
      computedWpm: null,

      // Final scores (computed on demand)
      _scored: false
    };

    _documentWordCount += wordCount;
    _log('Registered section:', sectionId, '(' + wordCount + ' words)');
  }

  // ============================================================
  // INTERSECTION OBSERVER (viewport tracking)
  // ============================================================

  function _setupObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      _log('IntersectionObserver not available — falling back to scroll polling');
      return;
    }

    _observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var el = entry.target;
        var sectionId = el.getAttribute('data-sws-section') || el.id;
        var section = _sections[sectionId];
        if (!section) return;

        var now = _now();

        if (entry.isIntersecting && entry.intersectionRatio >= _config.minIntersectionRatio) {
          // Section entered viewport
          if (!section.isVisible) {
            section.isVisible = true;
            section.lastEntryTime = now;
            section.viewEntries++;
            _activeSections[sectionId] = true;

            // Re-read detection
            if (section.hasBeenRead) {
              section.reReadCount++;
              _log('Re-read detected:', sectionId, '(count: ' + section.reReadCount + ')');
            }

            _log('Section visible:', sectionId);
          }

          // Track max intersection ratio
          section.maxIntersectionRatio = Math.max(section.maxIntersectionRatio, entry.intersectionRatio);
          section.intersectionSamples.push(entry.intersectionRatio);
          if (section.intersectionSamples.length > 100) section.intersectionSamples.shift();

        } else if (section.isVisible) {
          // Section left viewport
          _sectionExited(sectionId, now);
        }
      });
    }, {
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    });
  }

  function _sectionExited(sectionId, now) {
    var section = _sections[sectionId];
    if (!section || !section.isVisible) return;

    section.isVisible = false;
    delete _activeSections[sectionId];

    if (section.lastEntryTime) {
      var dwellThisVisit = now - section.lastEntryTime;
      section.totalDwellMs += dwellThisVisit;

      // Mark as "read" if sufficient dwell time
      if (section.totalDwellMs >= _config.minViewTimeMs) {
        section.hasBeenRead = true;
      }

      _log('Section exited:', sectionId, '(dwell this visit: ' + dwellThisVisit + 'ms, total: ' + section.totalDwellMs + 'ms)');
    }
    section.lastEntryTime = null;
  }

  // ============================================================
  // DWELL TIME ACCUMULATOR
  // ============================================================

  function _startDwellTimer() {
    _dwellTimer = setInterval(function() {
      // Accumulate dwell for all currently visible sections
      // (the observer handles entry/exit, this just keeps the clock running)
      var now = _now();
      for (var sectionId in _activeSections) {
        if (_activeSections.hasOwnProperty(sectionId)) {
          var section = _sections[sectionId];
          if (section && section.isVisible && section.lastEntryTime) {
            // Dwell is accumulated on exit, but we update a running total for live queries
            section._liveDwell = section.totalDwellMs + (now - section.lastEntryTime);
          }
        }
      }
    }, _config.dwellPollMs);
  }

  // ============================================================
  // ACTIVE ENGAGEMENT SIGNALS
  // ============================================================

  function _onMouseMove() {
    for (var sectionId in _activeSections) {
      if (_activeSections.hasOwnProperty(sectionId) && _sections[sectionId]) {
        _sections[sectionId].activeSignals++;
      }
    }
  }

  function _onClick(e) {
    for (var sectionId in _activeSections) {
      if (_activeSections.hasOwnProperty(sectionId) && _sections[sectionId]) {
        _sections[sectionId].clicksDuringView++;
        _sections[sectionId].activeSignals++;
      }
    }
  }

  function _onSelectionChange() {
    var sel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
    if (sel && sel.toString().length > 0) {
      for (var sectionId in _activeSections) {
        if (_activeSections.hasOwnProperty(sectionId) && _sections[sectionId]) {
          _sections[sectionId].textSelections++;
          _sections[sectionId].activeSignals++;
        }
      }
    }
  }

  function _onScroll() {
    var now = _now();
    for (var sectionId in _activeSections) {
      if (_activeSections.hasOwnProperty(sectionId) && _sections[sectionId]) {
        var section = _sections[sectionId];
        var scrollY = (typeof window !== 'undefined') ? window.scrollY : 0;
        section.scrollVelocities.push({ y: scrollY, t: now });
        if (section.scrollVelocities.length > 200) section.scrollVelocities.shift();
      }
    }
  }

  // ============================================================
  // SCORING ENGINE
  // ============================================================

  /**
   * Score a single section's attention quality.
   * Returns 0-1 where 1 = deeply read, 0 = skipped/botted.
   */
  function _scoreSection(sectionId) {
    var section = _sections[sectionId];
    if (!section) return null;

    // Finalize dwell if still visible
    if (section.isVisible && section.lastEntryTime) {
      section._liveDwell = section.totalDwellMs + (_now() - section.lastEntryTime);
    } else {
      section._liveDwell = section.totalDwellMs;
    }

    var scores = {};

    // 1. Dwell Time Score
    // Expected reading time based on word count (avg 200 WPM)
    var expectedReadMs = (section.wordCount / 200) * 60 * 1000;
    var minExpected = Math.max(_config.minViewTimeMs, expectedReadMs * 0.3); // at least 30% of expected
    if (section._liveDwell >= expectedReadMs * 0.8) {
      scores.dwell = 1.0; // read at normal pace or slower
    } else if (section._liveDwell >= minExpected) {
      scores.dwell = 0.5 + 0.5 * (section._liveDwell - minExpected) / (expectedReadMs * 0.8 - minExpected);
    } else if (section._liveDwell >= _config.minViewTimeMs) {
      scores.dwell = 0.3 * (section._liveDwell / minExpected);
    } else {
      scores.dwell = 0; // barely seen
    }
    scores.dwell = Math.min(1, Math.max(0, scores.dwell));

    // 2. Reading Pace Score (WPM)
    if (section.wordCount > 0 && section._liveDwell > 0) {
      var wpm = (section.wordCount / section._liveDwell) * 60 * 1000;
      section.computedWpm = Math.round(wpm);

      if (wpm >= _config.humanReadingWpmMin && wpm <= _config.humanReadingWpmMax) {
        scores.readingPace = 1.0; // normal human reading speed
      } else if (wpm < _config.humanReadingWpmMin) {
        // Slower than expected — could be careful reading or distraction
        scores.readingPace = 0.7; // still likely human
      } else if (wpm <= _config.skimmingWpmThreshold) {
        // Fast but possible skimming
        scores.readingPace = 0.4;
      } else {
        // Impossibly fast — scrolled through without reading
        scores.readingPace = 0.1;
      }
    } else {
      scores.readingPace = 0;
    }

    // 3. Re-read Score (humans re-read confusing parts)
    if (section.reReadCount >= 2) {
      scores.reRead = 1.0; // multiple re-reads = genuine engagement
    } else if (section.reReadCount === 1) {
      scores.reRead = 0.7;
    } else {
      scores.reRead = 0.3; // no re-reads isn't necessarily bad
    }

    // 4. Active Engagement Score
    var expectedSignals = Math.max(_config.minActiveSignals, section._liveDwell / 2000);
    if (section.activeSignals >= expectedSignals) {
      scores.activeEngagement = 1.0;
    } else if (section.activeSignals > 0) {
      scores.activeEngagement = 0.3 + 0.7 * (section.activeSignals / expectedSignals);
    } else {
      scores.activeEngagement = 0.1; // no interaction at all while viewing
    }
    scores.activeEngagement = Math.min(1, scores.activeEngagement);

    // 5. Scroll Velocity Score (how fast they scrolled through this section)
    if (section.scrollVelocities.length >= 2) {
      var velocities = [];
      for (var i = 1; i < section.scrollVelocities.length; i++) {
        var dy = Math.abs(section.scrollVelocities[i].y - section.scrollVelocities[i - 1].y);
        var dt = section.scrollVelocities[i].t - section.scrollVelocities[i - 1].t;
        if (dt > 0) velocities.push(dy / dt);
      }
      if (velocities.length > 0) {
        var avgVelocity = velocities.reduce(function(a, b) { return a + b; }, 0) / velocities.length;
        // Slow scrolling (<0.5 px/ms) = reading; fast (>2 px/ms) = skimming
        if (avgVelocity < 0.3) {
          scores.scrollVelocity = 1.0;
        } else if (avgVelocity < 1.0) {
          scores.scrollVelocity = 0.7;
        } else if (avgVelocity < 2.0) {
          scores.scrollVelocity = 0.4;
        } else {
          scores.scrollVelocity = 0.1;
        }
      } else {
        scores.scrollVelocity = 0.5;
      }
    } else {
      scores.scrollVelocity = 0.5; // no scroll data
    }

    // 6. Viewport Coverage Score
    if (section.intersectionSamples.length > 0) {
      var avgRatio = section.intersectionSamples.reduce(function(a, b) { return a + b; }, 0) / section.intersectionSamples.length;
      scores.viewportCoverage = avgRatio;
    } else {
      scores.viewportCoverage = section.maxIntersectionRatio;
    }

    // Composite section score (weighted)
    var composite = (
      scores.dwell * 0.30 +
      scores.readingPace * 0.20 +
      scores.reRead * 0.10 +
      scores.activeEngagement * 0.15 +
      scores.scrollVelocity * 0.15 +
      scores.viewportCoverage * 0.10
    );

    return {
      sectionId: sectionId,
      title: section.title,
      wordCount: section.wordCount,
      dwellMs: Math.round(section._liveDwell),
      computedWpm: section.computedWpm,
      viewEntries: section.viewEntries,
      reReadCount: section.reReadCount,
      activeSignals: section.activeSignals,
      textSelections: section.textSelections,
      scores: scores,
      composite: Math.round(composite * 1000) / 1000,
      verdict: composite >= 0.7 ? 'read' :
               composite >= 0.4 ? 'skimmed' :
               composite >= 0.2 ? 'glanced' : 'missed'
    };
  }

  // ============================================================
  // DOCUMENT-LEVEL ANALYSIS
  // ============================================================

  /**
   * Score the entire document's attention quality.
   */
  function _scoreDocument() {
    var sectionScores = [];
    var sectionIds = Object.keys(_sections);

    // Close out any still-visible sections
    var now = _now();
    for (var sid in _activeSections) {
      if (_activeSections.hasOwnProperty(sid)) {
        var s = _sections[sid];
        if (s && s.isVisible && s.lastEntryTime) {
          s._liveDwell = s.totalDwellMs + (now - s.lastEntryTime);
        }
      }
    }

    sectionIds.forEach(function(id) {
      var score = _scoreSection(id);
      if (score) sectionScores.push(score);
    });

    if (sectionScores.length === 0) {
      return {
        documentScore: 0,
        verdict: 'no_data',
        totalSections: 0,
        sectionsRead: 0,
        sectionsSkimmed: 0,
        sectionsMissed: 0,
        totalDwellMs: 0,
        sections: []
      };
    }

    // Sort by section order
    sectionScores.sort(function(a, b) {
      var sa = _sections[a.sectionId];
      var sb = _sections[b.sectionId];
      return (sa ? sa.order : 0) - (sb ? sb.order : 0);
    });

    var totalDwell = 0;
    var sectionsRead = 0;
    var sectionsSkimmed = 0;
    var sectionsMissed = 0;
    var weightedSum = 0;
    var totalWords = 0;

    sectionScores.forEach(function(ss) {
      totalDwell += ss.dwellMs;
      totalWords += ss.wordCount;

      // Weight by word count (longer sections matter more)
      var weight = ss.wordCount || 1;
      weightedSum += ss.composite * weight;

      if (ss.verdict === 'read') sectionsRead++;
      else if (ss.verdict === 'skimmed') sectionsSkimmed++;
      else sectionsMissed++;
    });

    var documentScore = totalWords > 0 ? weightedSum / totalWords : 0;
    documentScore = Math.round(documentScore * 1000) / 1000;

    // Reading order analysis — did they read top-to-bottom or jump around?
    var readOrder = sectionScores
      .filter(function(ss) { return ss.verdict === 'read' || ss.verdict === 'skimmed'; })
      .map(function(ss) { return _sections[ss.sectionId] ? _sections[ss.sectionId].order : 0; });

    var orderScore = 1.0;
    if (readOrder.length >= 2) {
      var outOfOrder = 0;
      for (var i = 1; i < readOrder.length; i++) {
        if (readOrder[i] < readOrder[i - 1]) outOfOrder++;
      }
      orderScore = 1 - (outOfOrder / (readOrder.length - 1));
    }

    var documentVerdict;
    if (documentScore >= 0.7 && sectionsRead >= sectionScores.length * 0.8) {
      documentVerdict = 'thoroughly_read';
    } else if (documentScore >= 0.5) {
      documentVerdict = 'partially_read';
    } else if (documentScore >= 0.25) {
      documentVerdict = 'skimmed';
    } else {
      documentVerdict = 'not_read';
    }

    return {
      documentScore: documentScore,
      verdict: documentVerdict,
      readingOrderScore: Math.round(orderScore * 1000) / 1000,
      totalSections: sectionScores.length,
      sectionsRead: sectionsRead,
      sectionsSkimmed: sectionsSkimmed,
      sectionsMissed: sectionsMissed,
      totalDwellMs: totalDwell,
      totalWordCount: totalWords,
      overallWpm: totalWords > 0 && totalDwell > 0 ?
        Math.round((totalWords / totalDwell) * 60 * 1000) : 0,
      sections: sectionScores
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  var ContentAttentionTracker = {
    /**
     * Initialize the tracker.
     * @param {object} config - Override defaults
     */
    init: function(config) {
      _config = {};
      for (var key in DEFAULT_CONFIG) {
        if (DEFAULT_CONFIG.hasOwnProperty(key)) {
          _config[key] = (config && config[key] !== undefined) ? config[key] : DEFAULT_CONFIG[key];
        }
      }
      _startTime = _now();
      _sections = {};
      _activeSections = {};
      _mouseMoveDuringView = {};
      _initialized = true;

      // Set up IntersectionObserver if in browser
      if (typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined') {
        _setupObserver();
      }

      _log('Initialized with config:', _config);
    },

    /**
     * Register a content section for tracking.
     * In browser: pass element reference or call autoDetect().
     * In server/test: pass { sectionId, wordCount, title, order }.
     */
    registerSection: function(sectionId, meta) {
      if (!_initialized) this.init({});
      meta = meta || {};
      _registerSection(sectionId, meta);

      // If element provided and observer available, observe it
      if (meta.element && _observer) {
        _observer.observe(meta.element);
      }
    },

    /**
     * Auto-detect and register all sections matching the configured selector.
     * Browser only.
     */
    autoDetect: function() {
      if (typeof document === 'undefined') return;
      if (!_initialized) this.init({});

      var elements = document.querySelectorAll(_config.sectionSelector);
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var sectionId = el.getAttribute('data-sws-section') || el.id || ('section_' + i);
        this.registerSection(sectionId, {
          element: el,
          title: el.getAttribute('data-sws-title') || el.getAttribute('title') || sectionId,
          order: i
        });
      }

      // Attach engagement listeners
      if (typeof document !== 'undefined') {
        document.addEventListener('mousemove', _onMouseMove, { passive: true });
        document.addEventListener('click', _onClick, { passive: true });
        document.addEventListener('selectionchange', _onSelectionChange, { passive: true });
        document.addEventListener('scroll', _onScroll, { passive: true });
      }

      _startDwellTimer();
      _log('Auto-detected', elements.length, 'sections');
    },

    /**
     * Simulate a section entering the viewport (for testing / server-side).
     */
    simulateView: function(sectionId, dwellMs, options) {
      options = options || {};
      var section = _sections[sectionId];
      if (!section) return;

      section.isVisible = true;
      section.lastEntryTime = _now() - dwellMs;
      section.viewEntries = (section.viewEntries || 0) + (options.viewEntry !== false ? 1 : 0);
      section.totalDwellMs += dwellMs;
      section.isVisible = false;
      section.lastEntryTime = null;

      if (section.totalDwellMs >= _config.minViewTimeMs) {
        section.hasBeenRead = true;
      }

      // Apply optional signals
      if (options.reReadCount !== undefined) section.reReadCount = options.reReadCount;
      if (options.activeSignals !== undefined) section.activeSignals = options.activeSignals;
      if (options.textSelections !== undefined) section.textSelections = options.textSelections;
      if (options.scrollVelocities) section.scrollVelocities = options.scrollVelocities;
      if (options.intersectionSamples) section.intersectionSamples = options.intersectionSamples;
    },

    /**
     * Score a single section.
     */
    scoreSection: function(sectionId) {
      return _scoreSection(sectionId);
    },

    /**
     * Score the entire document.
     */
    scoreDocument: function() {
      return _scoreDocument();
    },

    /**
     * Get raw section data (for debugging / server submission).
     */
    getSectionData: function(sectionId) {
      return _sections[sectionId] || null;
    },

    /**
     * Get all section IDs.
     */
    getSectionIds: function() {
      return Object.keys(_sections);
    },

    /**
     * Export all data for server-side analysis.
     */
    exportForServer: function() {
      var data = {
        documentWordCount: _documentWordCount,
        sessionDurationMs: _now() - _startTime,
        sections: {}
      };

      for (var id in _sections) {
        if (_sections.hasOwnProperty(id)) {
          var s = _sections[id];
          // Finalize live dwell
          if (s.isVisible && s.lastEntryTime) {
            s._liveDwell = s.totalDwellMs + (_now() - s.lastEntryTime);
          } else {
            s._liveDwell = s.totalDwellMs;
          }

          data.sections[id] = {
            title: s.title,
            order: s.order,
            wordCount: s.wordCount,
            totalDwellMs: Math.round(s._liveDwell || s.totalDwellMs),
            viewEntries: s.viewEntries,
            reReadCount: s.reReadCount,
            activeSignals: s.activeSignals,
            textSelections: s.textSelections,
            maxIntersectionRatio: s.maxIntersectionRatio,
            scrollVelocities: s.scrollVelocities.slice(-50),
            intersectionSamples: s.intersectionSamples.slice(-20)
          };
        }
      }
      return data;
    },

    /**
     * Reset all tracking data.
     */
    reset: function() {
      if (_dwellTimer) clearInterval(_dwellTimer);
      if (_observer) _observer.disconnect();
      _sections = {};
      _activeSections = {};
      _documentWordCount = 0;
      _initialized = false;
      _observer = null;
      _dwellTimer = null;
    },

    // Expose internals for testing
    _internal: {
      scoreSection: _scoreSection,
      scoreDocument: _scoreDocument,
      countWords: _countWords,
      sections: function() { return _sections; },
      config: function() { return _config; }
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentAttentionTracker;
  } else if (typeof root !== 'undefined') {
    root.SWSContentTracker = ContentAttentionTracker;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
