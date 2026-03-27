/**
 * SWS Attention Protocol — Integration Examples
 * Copy-paste ready code for every supported vertical.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */

// ============================================================
// EXAMPLE 1: SURVEY PLATFORM (Qualtrics, SurveyMonkey, Typeform)
// Drop this into any survey page to score response quality.
// ============================================================

var SurveyScoringExample = {
  init: function() {
    SWSAttention.init({ gameId: 'survey_platform_demo', debug: true });

    // Track when each question is shown
    this.questionStartTime = Date.now();
    this.questionNumber = 0;
  },

  onQuestionShown: function(questionId, optionCount) {
    this.questionStartTime = Date.now();
    this.questionNumber++;

    // Tell the protocol about the content render (for micro-pause analysis)
    SWSAttention.recordContentRender(optionCount > 5 ? 'complex' : 'moderate');
  },

  onQuestionAnswered: function(questionId, optionCount) {
    var responseTime = Date.now() - this.questionStartTime;

    // Record the decision for Hick's Law analysis
    SWSAttention.recordDecision(optionCount, responseTime);

    // Earn a hash for genuine engagement with this question
    if (responseTime > 2000) { // More than 2 seconds = actually read it
      SWSAttention.earn('question_answered', responseTime, 1, responseTime > 10000 ? 'deep' : 'active');
    }
  },

  onSurveyComplete: function() {
    var stats = SWSAttention.getStats();
    var receipt = null;

    // Generate completion receipt if receipts module is loaded
    if (window.SWSReceipts) {
      receipt = SWSReceipts.generateCompletionReceipt({
        contentId: 'survey_' + Date.now(),
        contentName: 'Survey Response',
        completionType: 'survey',
        durationMs: stats.sessionDurationMs,
        focusScore: stats.focusScore,
        qualityTier: stats.focusScore >= 70 ? 'deep' : stats.focusScore >= 40 ? 'active' : 'passive',
        interactionCount: stats.totalHashes,
        humanConfidence: stats.humanConfidence,
        startedAt: Date.now() - stats.sessionDurationMs
      });
    }

    // Return the quality score to the survey platform
    return {
      focusScore: stats.focusScore,
      humanConfidence: stats.humanConfidence ? stats.humanConfidence.composite : null,
      timingCV: stats.humanConfidence ? stats.humanConfidence.timing : null,
      totalHashes: stats.totalHashes,
      sessionDuration: stats.sessionDurationMs,
      receipt: receipt,
      verdict: stats.focusScore >= 60 ? 'QUALITY_RESPONSE' :
               stats.focusScore >= 30 ? 'MARGINAL_RESPONSE' : 'LOW_QUALITY_RESPONSE'
    };
  }
};


// ============================================================
// EXAMPLE 2: TRAINING MODULE (Relias, HealthStream, CareAcademy)
// Verifies genuine engagement with compliance training.
// ============================================================

var TrainingVerificationExample = {
  moduleId: '',
  moduleName: '',
  moduleStartTime: 0,
  requiredMinutes: 0,
  sectionTimes: [],

  startModule: function(moduleId, moduleName, requiredMinutes) {
    SWSAttention.init({ gameId: 'training_platform_demo', debug: true });

    this.moduleId = moduleId;
    this.moduleName = moduleName;
    this.requiredMinutes = requiredMinutes;
    this.moduleStartTime = Date.now();
    this.sectionTimes = [];

    SWSAttention.earn('game_start', 0, 0, 'deep');
    SWSAttention.recordContentRender('complex');
  },

  onSectionViewed: function(sectionId, sectionType) {
    // sectionType: 'video', 'text', 'quiz', 'interactive'
    this.sectionTimes.push({
      sectionId: sectionId,
      type: sectionType,
      startTime: Date.now()
    });

    var complexity = sectionType === 'quiz' ? 'complex' : sectionType === 'video' ? 'moderate' : 'simple';
    SWSAttention.recordContentRender(complexity);
  },

  onSectionComplete: function(sectionId) {
    var section = this.sectionTimes.find(function(s) { return s.sectionId === sectionId; });
    if (section) {
      var duration = Date.now() - section.startTime;
      section.duration = duration;
      SWSAttention.earn('game_milestone', duration, 1, duration > 60000 ? 'deep' : 'active');
    }
  },

  onQuizAnswer: function(questionId, optionCount, isCorrect) {
    var responseTime = Date.now() - (this.sectionTimes[this.sectionTimes.length - 1] || { startTime: Date.now() }).startTime;
    SWSAttention.recordDecision(optionCount, responseTime);

    if (isCorrect) {
      SWSAttention.earn('challenge_complete', responseTime, 1, 'deep');
    }
  },

  completeModule: function() {
    var duration = Date.now() - this.moduleStartTime;
    var stats = SWSAttention.getStats();

    SWSAttention.earn('game_complete', duration, stats.totalHashes, 'deep');

    // Generate the compliance receipt — this is what the auditor sees
    var receipt = null;
    if (window.SWSReceipts) {
      receipt = SWSReceipts.generateCompletionReceipt({
        userId: SWSAttention.getUserId(),
        contentId: this.moduleId,
        contentName: this.moduleName,
        completionType: 'training_module',
        durationMs: duration,
        focusScore: stats.focusScore,
        qualityTier: stats.focusScore >= 60 ? 'deep' : stats.focusScore >= 30 ? 'active' : 'passive',
        interactionCount: stats.totalHashes,
        humanConfidence: stats.humanConfidence,
        startedAt: this.moduleStartTime,
        minimumMinutes: this.requiredMinutes
      });
    }

    return {
      moduleId: this.moduleId,
      moduleName: this.moduleName,
      duration: duration,
      durationFormatted: Math.floor(duration / 60000) + ' min ' + Math.floor((duration % 60000) / 1000) + ' sec',
      requiredMinutes: this.requiredMinutes,
      metMinimum: (duration / 60000) >= this.requiredMinutes,
      focusScore: stats.focusScore,
      humanConfidence: stats.humanConfidence ? Math.round(stats.humanConfidence.composite * 100) : null,
      genuineCompletion: stats.focusScore >= 40 && (duration / 60000) >= this.requiredMinutes,
      receipt: receipt,
      sections: this.sectionTimes
    };
  }
};


// ============================================================
// EXAMPLE 3: ADVERTISING / MEDIA (Verified Attention for Ads)
// Measures real attention on ad units.
// ============================================================

var AdVerificationExample = {
  activeAds: {},

  onAdVisible: function(adId, adFormat) {
    SWSAttention.init({ gameId: 'ad_verification_demo', debug: true });

    this.activeAds[adId] = {
      format: adFormat, // 'banner', 'video', 'interstitial', 'native'
      startTime: Date.now(),
      viewportTime: 0,
      interactions: 0
    };

    SWSAttention.recordContentRender(adFormat === 'video' ? 'complex' : 'simple');
  },

  onAdInteraction: function(adId, interactionType) {
    // interactionType: 'click', 'hover', 'scroll_past', 'expand', 'mute', 'unmute'
    if (this.activeAds[adId]) {
      this.activeAds[adId].interactions++;
    }
  },

  onAdHidden: function(adId) {
    var ad = this.activeAds[adId];
    if (!ad) return;

    var viewDuration = Date.now() - ad.startTime;
    ad.viewportTime = viewDuration;

    // Generate attention hash based on actual engagement
    var tier = 'passive';
    if (ad.interactions > 0 && viewDuration > 5000) tier = 'active';
    if (ad.interactions > 3 && viewDuration > 15000) tier = 'deep';

    SWSAttention.earn('ad_view_' + ad.format, viewDuration, ad.interactions, tier);

    var stats = SWSAttention.getStats();

    return {
      adId: adId,
      format: ad.format,
      viewDurationMs: viewDuration,
      viewDurationSec: (viewDuration / 1000).toFixed(1),
      interactions: ad.interactions,
      qualityTier: tier,
      focusScore: stats.focusScore,
      humanConfidence: stats.humanConfidence ? stats.humanConfidence.composite : null,
      // This is the money metric — verified attention seconds
      verifiedAttentionSeconds: tier !== 'background' ? Math.round(viewDuration / 1000) : 0,
      // What the advertiser actually pays for
      billableAttention: tier === 'deep' || tier === 'active'
    };
  },

  // Get aggregate attention metrics for a campaign
  getCampaignMetrics: function() {
    var stats = SWSAttention.getStats();
    var totalViewTime = 0;
    var totalInteractions = 0;

    for (var adId in this.activeAds) {
      if (this.activeAds.hasOwnProperty(adId)) {
        totalViewTime += this.activeAds[adId].viewportTime || 0;
        totalInteractions += this.activeAds[adId].interactions || 0;
      }
    }

    return {
      totalAdsServed: Object.keys(this.activeAds).length,
      totalViewTimeMs: totalViewTime,
      totalInteractions: totalInteractions,
      avgFocusScore: stats.focusScore,
      humanConfidence: stats.humanConfidence ? stats.humanConfidence.composite : null,
      attentionQualityBreakdown: stats.tierDistribution,
      verifiedAttentionMinutes: Math.round(totalViewTime / 60000)
    };
  }
};


// ============================================================
// EXAMPLE 4: EDUCATION (LMS Integration)
// Tracks student engagement with course material.
// ============================================================

var EducationExample = {
  courseId: '',
  lessonId: '',
  lessonStart: 0,
  readingSections: [],

  startLesson: function(courseId, lessonId) {
    SWSAttention.init({ gameId: 'education_lms_demo', debug: true });
    this.courseId = courseId;
    this.lessonId = lessonId;
    this.lessonStart = Date.now();
    SWSAttention.earn('game_start', 0, 0, 'active');
  },

  onReadingStart: function(sectionId, wordCount) {
    this.readingSections.push({
      sectionId: sectionId,
      wordCount: wordCount,
      startTime: Date.now(),
      endTime: null
    });
    // Complex content for longer readings
    SWSAttention.recordContentRender(wordCount > 500 ? 'complex' : wordCount > 200 ? 'moderate' : 'simple');
  },

  onReadingComplete: function(sectionId) {
    var section = this.readingSections.find(function(s) { return s.sectionId === sectionId; });
    if (!section) return;

    section.endTime = Date.now();
    var readingTime = section.endTime - section.startTime;
    var expectedTime = (section.wordCount / 200) * 60000; // 200 WPM average

    // If they spent at least 50% of expected reading time, it's genuine
    var genuine = readingTime >= (expectedTime * 0.5);

    SWSAttention.earn('game_milestone', readingTime, 1, genuine ? 'deep' : 'passive');

    return {
      sectionId: sectionId,
      readingTimeMs: readingTime,
      expectedTimeMs: expectedTime,
      readingRatio: (readingTime / expectedTime).toFixed(2),
      genuine: genuine
    };
  },

  onQuizSubmit: function(quizId, questionCount, correctCount, totalTimeMs) {
    SWSAttention.recordDecision(questionCount, totalTimeMs / questionCount);
    SWSAttention.earn('challenge_complete', totalTimeMs, questionCount, correctCount / questionCount > 0.7 ? 'deep' : 'active');

    return {
      quizId: quizId,
      score: Math.round(correctCount / questionCount * 100),
      avgTimePerQuestion: Math.round(totalTimeMs / questionCount),
      focusScore: SWSAttention.getStats().focusScore
    };
  },

  endLesson: function() {
    var stats = SWSAttention.getStats();
    SWSAttention.earn('game_complete', Date.now() - this.lessonStart, stats.totalHashes, 'deep');

    return {
      courseId: this.courseId,
      lessonId: this.lessonId,
      duration: Date.now() - this.lessonStart,
      focusScore: stats.focusScore,
      humanConfidence: stats.humanConfidence ? stats.humanConfidence.composite : null,
      hashesGenerated: stats.totalHashes,
      readingSections: this.readingSections.length,
      genuineEngagement: stats.focusScore >= 50
    };
  }
};


// ============================================================
// EXAMPLE 5: INSURANCE TRAINING VERIFICATION
// Standalone training verification for insurance policyholders.
// ============================================================

var InsuranceTrainingExample = {
  policyNumber: '',
  courseType: '',
  courseStart: 0,

  startCourse: function(policyNumber, courseType) {
    // courseType: 'defensive_driving', 'workplace_safety', 'health_wellness'
    SWSAttention.init({ gameId: 'insurance_training_demo', debug: true });
    this.policyNumber = policyNumber; // Note: not stored in hash payload — privacy safe
    this.courseType = courseType;
    this.courseStart = Date.now();
    SWSAttention.earn('game_start', 0, 0, 'active');
  },

  onVideoWatched: function(videoId, videoDurationMs, actualWatchTimeMs) {
    var watchRatio = actualWatchTimeMs / videoDurationMs;

    // If they watched less than 60% of the video, it's passive
    var tier = watchRatio >= 0.9 ? 'deep' : watchRatio >= 0.6 ? 'active' : 'passive';
    SWSAttention.earn('game_milestone', actualWatchTimeMs, 1, tier);

    return {
      videoId: videoId,
      watchRatio: (watchRatio * 100).toFixed(0) + '%',
      tier: tier,
      genuine: watchRatio >= 0.6
    };
  },

  completeCourse: function() {
    var duration = Date.now() - this.courseStart;
    var stats = SWSAttention.getStats();

    SWSAttention.earn('game_complete', duration, stats.totalHashes, 'deep');

    var receipt = null;
    if (window.SWSReceipts) {
      receipt = SWSReceipts.generateCompletionReceipt({
        contentId: this.courseType,
        contentName: this.courseType.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }),
        completionType: 'training_module',
        durationMs: duration,
        focusScore: stats.focusScore,
        qualityTier: stats.focusScore >= 60 ? 'deep' : 'active',
        interactionCount: stats.totalHashes,
        humanConfidence: stats.humanConfidence,
        startedAt: this.courseStart
      });
    }

    // This is what goes to the insurance company
    return {
      verification: {
        course_type: this.courseType,
        completed_at: new Date().toISOString(),
        duration_minutes: Math.round(duration / 60000),
        focus_score: stats.focusScore,
        human_verified: stats.humanConfidence ? stats.humanConfidence.composite >= 0.5 : null,
        genuine_completion: stats.focusScore >= 40,
        receipt_id: receipt ? receipt.receipt_id : null,
        cryptographic_proof: receipt ? receipt.proof.receipt_hash : null
      },
      full_receipt: receipt
    };
  }
};


// ============================================================
// EXPORT ALL EXAMPLES
// ============================================================

if (typeof window !== 'undefined') {
  window.SWSExamples = {
    Survey: SurveyScoringExample,
    Training: TrainingVerificationExample,
    Advertising: AdVerificationExample,
    Education: EducationExample,
    Insurance: InsuranceTrainingExample
  };
}
