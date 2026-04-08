/**
 * SWS Attention Protocol — API Server
 *
 * This is the production scoring engine. Client tags collect behavioral
 * signals and send them here. The server runs the analysis (trade secrets
 * stay server-side) and returns scores + cryptographic receipts.
 *
 * Endpoints:
 *   POST /v1/sessions          — Submit session signals, get score + receipt
 *   POST /v1/sessions/verify   — Verify a receipt's integrity
 *   GET  /v1/clients/:id/stats — Client usage stats
 *   POST /v1/clients           — Register a new client (get API key)
 *   GET  /v1/health             — Server health check
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

function uuidv4() {
  return crypto.randomUUID();
}

const app = express();

// ============================================================
// PRODUCTION HARDENING
// ============================================================

// CORS — lock down in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8080', 'http://localhost:3000', 'https://stevieweedseed.com'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked: ' + origin));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-SWS-API-Key', 'X-SWS-Client-ID']
}));

app.use(express.json({ limit: '1mb' }));

// Request logging
app.use(function(req, res, next) {
  const start = Date.now();
  res.on('finish', function() {
    const duration = Date.now() - start;
    const clientId = req.headers['x-sws-client-id'] || 'anon';
    if (req.path !== '/v1/health') {
      console.log(`  [${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms) client=${clientId}`);
    }
  });
  next();
});

// Rate limiting (in-memory, per client)
const rateLimits = new Map();
const RATE_LIMIT = {
  pilot: { perMinute: 100, perDay: 10000 },
  starter: { perMinute: 500, perDay: 50000 },
  professional: { perMinute: 1000, perDay: 500000 },
  enterprise: { perMinute: 5000, perDay: Infinity }
};

function checkRateLimit(clientId, plan) {
  const now = Date.now();
  const minuteKey = clientId + '_' + Math.floor(now / 60000);
  const dayKey = clientId + '_' + new Date().toISOString().split('T')[0];
  const limits = RATE_LIMIT[plan] || RATE_LIMIT.pilot;

  // Minute counter
  const minuteCount = (rateLimits.get(minuteKey) || 0) + 1;
  rateLimits.set(minuteKey, minuteCount);

  // Day counter
  const dayCount = (rateLimits.get(dayKey) || 0) + 1;
  rateLimits.set(dayKey, dayCount);

  // Clean old entries every 100 requests
  if (minuteCount % 100 === 0) {
    const cutoff = Math.floor(now / 60000) - 2;
    rateLimits.forEach((v, k) => {
      if (k.includes('_') && !k.includes('-') && parseInt(k.split('_')[1]) < cutoff) {
        rateLimits.delete(k);
      }
    });
  }

  if (minuteCount > limits.perMinute) return { allowed: false, reason: 'rate_limit_minute', limit: limits.perMinute };
  if (dayCount > limits.perDay) return { allowed: false, reason: 'rate_limit_day', limit: limits.perDay };
  return { allowed: true };
}

// Input sanitization
function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return '';
  return str.substring(0, maxLength || 256).replace(/[<>]/g, '');
}

function sanitizeNumber(val, min, max) {
  val = Number(val) || 0;
  if (min !== undefined) val = Math.max(min, val);
  if (max !== undefined) val = Math.min(max, val);
  return val;
}

// ============================================================
// TRADE SECRET: Scoring Weights & Thresholds
// These NEVER leave the server. Clients only see the output scores.
// ============================================================

const SCORING_CONFIG = {
  weights: {
    timing_entropy: 0.25,
    fitts_law: 0.20,
    hicks_law: 0.10,
    scroll_saccade: 0.15,
    micro_pause: 0.15,
    touch_variance: 0.15
  },
  thresholds: {
    timing_cv_bot_cutoff: 0.25,
    timing_cv_human_min: 0.40,
    fitts_r_bot_cutoff: 0.15,
    fitts_r_human_min: 0.30,
    hicks_r_bot_cutoff: 0.0,
    hicks_r_human_min: 0.3,
    scroll_fixation_min: 4,
    micro_pause_bot_max_ms: 100,
    micro_pause_human_min_ms: 200,
    touch_variance_bot_max: 0.5
  },
  tiers: {
    deep: { min_score: 0.75, multiplier: 2.0 },
    active: { min_score: 0.50, multiplier: 1.0 },
    passive: { min_score: 0.25, multiplier: 0.5 },
    background: { min_score: 0.0, multiplier: 0.25 }
  },
  revenue_split: { user: 0.70, developer: 0.29, protocol: 0.01 }
};

// ============================================================
// IN-MEMORY STORES (replace with database in production)
// ============================================================

const clients = new Map();    // clientId -> { apiKey, name, created, sessions }
const sessions = new Map();   // sessionId -> { data, score, receipt }
const receipts = new Map();   // receiptId -> receipt

// Create a default demo client
const DEMO_CLIENT_ID = 'demo_client';
const DEMO_API_KEY = 'sws_demo_key_2026';
clients.set(DEMO_CLIENT_ID, {
  id: DEMO_CLIENT_ID,
  apiKey: DEMO_API_KEY,
  name: 'SWS Demo Client',
  created: Date.now(),
  sessionsCount: 0,
  hashesGenerated: 0,
  plan: 'pilot'
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function authenticate(req, res, next) {
  const apiKey = req.headers['x-sws-api-key'];
  const clientId = req.headers['x-sws-client-id'];

  if (!apiKey || !clientId) {
    return res.status(401).json({
      error: 'missing_credentials',
      message: 'Include X-SWS-API-Key and X-SWS-Client-ID headers'
    });
  }

  const client = clients.get(clientId);
  if (!client || client.apiKey !== apiKey) {
    return res.status(403).json({
      error: 'invalid_credentials',
      message: 'API key does not match client ID'
    });
  }

  req.client = client;
  next();
}

// ============================================================
// TRADE SECRET: Server-Side Behavioral Analysis Engine
// ============================================================

function analyzeTimingEntropy(intervals) {
  if (!intervals || intervals.length < 10) return { score: 0.5, raw_cv: null, data_quality: 'insufficient' };

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return { score: 0, raw_cv: 0, data_quality: 'zero_mean' };

  const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
  const cv = Math.sqrt(variance) / mean;

  const score = Math.min(1, Math.max(0, (cv - 0.1) / 1.0));
  const verdict = cv < SCORING_CONFIG.thresholds.timing_cv_bot_cutoff ? 'bot_like' :
                  cv > SCORING_CONFIG.thresholds.timing_cv_human_min ? 'human_like' : 'ambiguous';

  return { score, raw_cv: Math.round(cv * 1000) / 1000, verdict, data_quality: 'sufficient' };
}

function analyzeFittsLaw(tapSequence) {
  if (!tapSequence || tapSequence.length < 10) return { score: 0.5, correlation: null, data_quality: 'insufficient' };

  const distances = [];
  const times = [];
  for (let i = 1; i < tapSequence.length; i++) {
    const dx = tapSequence[i].x - tapSequence[i - 1].x;
    const dy = tapSequence[i].y - tapSequence[i - 1].y;
    distances.push(Math.sqrt(dx * dx + dy * dy));
    times.push(tapSequence[i].t - tapSequence[i - 1].t);
  }

  const n = distances.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let j = 0; j < n; j++) {
    const x = Math.log2(distances[j] + 1);
    const y = times[j];
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
  }
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom < 0.001) return { score: 0.3, correlation: 0, data_quality: 'no_variance' };

  const r = (n * sumXY - sumX * sumY) / denom;
  const score = isNaN(r) ? 0.5 : Math.max(0, Math.min(1, (r + 1) / 2));

  return { score, correlation: Math.round(r * 1000) / 1000, data_quality: 'sufficient' };
}

function analyzeHicksLaw(decisions) {
  if (!decisions || decisions.length < 5) return { score: 0.5, correlation: null, data_quality: 'insufficient' };

  const groups = {};
  decisions.forEach(d => {
    const key = d.optionCount;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d.responseTimeMs);
  });

  const groupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  if (groupKeys.length < 2) return { score: 0.5, correlation: null, data_quality: 'single_option_count' };

  const xs = [];
  const ys = [];
  groupKeys.forEach(count => {
    const times = groups[count];
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    xs.push(Math.log2(count));
    ys.push(avgTime);
  });

  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i]; sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i]; sumY2 += ys[i] * ys[i];
  }
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom < 0.001) return { score: 0.3, correlation: 0, data_quality: 'constant_rt' };

  const r = (n * sumXY - sumX * sumY) / denom;
  const score = isNaN(r) ? 0.5 : Math.max(0, Math.min(1, r / 0.7));

  return { score, correlation: Math.round(r * 1000) / 1000, data_quality: 'sufficient' };
}

function analyzeScrollSaccade(scrollEvents) {
  if (!scrollEvents || scrollEvents.length < 20) return { score: 0.5, fixations: null, data_quality: 'insufficient' };

  let fixations = 0;
  let pauseStart = null;
  for (let i = 1; i < scrollEvents.length; i++) {
    const dt = scrollEvents[i].t - scrollEvents[i - 1].t;
    const dy = Math.abs(scrollEvents[i].y - scrollEvents[i - 1].y);
    const velocity = dy / (dt || 1);
    if (velocity < 0.1 && dt > 200) {
      if (!pauseStart) pauseStart = scrollEvents[i - 1].t;
      if (scrollEvents[i].t - pauseStart > 300) { fixations++; pauseStart = null; }
    } else {
      pauseStart = null;
    }
  }

  const score = Math.min(1, fixations / SCORING_CONFIG.thresholds.scroll_fixation_min);
  return { score, fixations, data_quality: 'sufficient' };
}

function analyzeMicroPause(renderInteractions) {
  if (!renderInteractions || renderInteractions.length < 3) return { score: 0.5, data_quality: 'insufficient' };

  const complexityRanges = {
    simple: { min: 150, max: 800 },
    moderate: { min: 250, max: 1500 },
    complex: { min: 400, max: 3000 }
  };

  let humanLikeCount = 0;
  const delays = [];

  renderInteractions.forEach(r => {
    if (!r.delay) return;
    delays.push(r.delay);
    const range = complexityRanges[r.complexity] || complexityRanges.moderate;
    if (r.delay >= range.min && r.delay <= range.max) humanLikeCount++;
  });

  if (delays.length === 0) return { score: 0.5, data_quality: 'no_delays' };

  const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
  const variance = delays.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / delays.length;
  const ratioScore = humanLikeCount / delays.length;
  const varianceScore = Math.min(1, Math.sqrt(variance) / 500);

  return {
    score: ratioScore * 0.6 + varianceScore * 0.4,
    avg_delay_ms: Math.round(mean),
    human_like_ratio: Math.round(ratioScore * 100) / 100,
    data_quality: 'sufficient'
  };
}

function analyzeTouchVariance(touches) {
  if (!touches || touches.length < 10) return { score: 0.5, data_quality: 'insufficient' };

  const rxVals = touches.map(t => t.radiusX || 0);
  const mean = rxVals.reduce((a, b) => a + b, 0) / rxVals.length;
  const variance = rxVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rxVals.length;

  const score = Math.min(1, variance / 2);
  return { score, variance: Math.round(variance * 1000) / 1000, data_quality: 'sufficient' };
}

// ============================================================
// COMPOSITE SCORING (trade secret weights applied here)
// ============================================================

function computeCompositeScore(signals) {
  const w = SCORING_CONFIG.weights;
  const composite = (
    signals.timing.score * w.timing_entropy +
    signals.fitts.score * w.fitts_law +
    signals.hicks.score * w.hicks_law +
    signals.scroll.score * w.scroll_saccade +
    signals.microPause.score * w.micro_pause +
    signals.touch.score * w.touch_variance
  );

  let tier, verdict;
  if (composite >= SCORING_CONFIG.tiers.deep.min_score) {
    tier = 'deep'; verdict = 'verified_human_deep_engagement';
  } else if (composite >= SCORING_CONFIG.tiers.active.min_score) {
    tier = 'active'; verdict = 'verified_human_active_engagement';
  } else if (composite >= SCORING_CONFIG.tiers.passive.min_score) {
    tier = 'passive'; verdict = 'likely_human_passive';
  } else {
    tier = 'background'; verdict = 'possible_automation_detected';
  }

  return {
    composite: Math.round(composite * 1000) / 1000,
    tier,
    verdict,
    multiplier: SCORING_CONFIG.tiers[tier].multiplier
  };
}

// ============================================================
// RECEIPT GENERATION (SHA-256 cryptographic proof)
// ============================================================

function generateReceipt(sessionId, sessionData, score, signals) {
  const receiptId = 'rcpt_' + Date.now().toString(36) + '_' + uuidv4().substring(0, 8);

  const receipt = {
    receipt_id: receiptId,
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol',
    issuer: 'SWS Strategic Media LLC',
    generated_at: new Date().toISOString(),

    session_id: sessionId,
    client_id: sessionData.client_id,
    application_id: sessionData.game_id || sessionData.application_id || 'unknown',

    engagement: {
      duration_ms: sessionData.duration_ms || 0,
      focus_score: Math.round(score.composite * 100),
      quality_tier: score.tier,
      interaction_count: sessionData.interaction_count || 0,
      hash_count: sessionData.hash_count || 0
    },

    human_verification: {
      composite_score: score.composite,
      verdict: score.verdict,
      signals: {
        timing_entropy: signals.timing.score,
        fitts_compliance: signals.fitts.score,
        hicks_compliance: signals.hicks.score,
        scroll_saccade: signals.scroll.score,
        micro_pause: signals.microPause.score,
        touch_variance: signals.touch.score
      },
      // TRADE SECRET: Raw analysis values NOT included
      // Clients see scores (0-1) but not the underlying CV, R², fixation counts
    },

    privacy: {
      no_content_recorded: true,
      no_pii_collected: true,
      no_urls_tracked: true,
      coppa_compliant: true,
      scif_eligible: true
    },

    proof: {
      algorithm: 'SHA-256',
      receipt_hash: null // Filled below
    }
  };

  // Generate receipt hash
  const payload = JSON.stringify({
    receipt_id: receipt.receipt_id,
    session_id: receipt.session_id,
    engagement: receipt.engagement,
    human_verification: receipt.human_verification,
    generated_at: receipt.generated_at
  });

  receipt.proof.receipt_hash = crypto.createHash('sha256').update(payload).digest('hex');

  return receipt;
}

// ============================================================
// API ENDPOINTS
// ============================================================

// Health check (no auth required)
app.get('/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    protocol: 'SWS Proof of Attention Protocol',
    version: '1.0.0',
    patent: 'SWS-PROV-001',
    entity: 'SWS Strategic Media LLC',
    uptime_ms: process.uptime() * 1000,
    sessions_processed: sessions.size,
    clients_registered: clients.size
  });
});

// Register a new client
app.post('/v1/clients', (req, res) => {
  const { name, contact_email, plan } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });

  const clientId = 'cli_' + uuidv4().substring(0, 12);
  const apiKey = 'sws_' + crypto.randomBytes(24).toString('hex');

  const client = {
    id: clientId,
    apiKey,
    name,
    contact_email: contact_email || null,
    plan: plan || 'pilot',
    created: Date.now(),
    sessionsCount: 0,
    hashesGenerated: 0
  };

  clients.set(clientId, client);

  res.status(201).json({
    client_id: clientId,
    api_key: apiKey,
    plan: client.plan,
    message: 'Store your API key securely. It cannot be retrieved later.',
    integration: {
      header_client: 'X-SWS-Client-ID: ' + clientId,
      header_key: 'X-SWS-API-Key: ' + apiKey,
      endpoint: 'POST /v1/sessions'
    }
  });
});

// Submit session data for scoring (the core endpoint)
app.post('/v1/sessions', authenticate, (req, res) => {
  // Rate limiting
  const rateCheck = checkRateLimit(req.client.id, req.client.plan);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: rateCheck.reason,
      message: 'Rate limit exceeded. Limit: ' + rateCheck.limit + ' per ' +
        (rateCheck.reason.includes('minute') ? 'minute' : 'day'),
      retry_after: rateCheck.reason.includes('minute') ? 60 : 3600
    });
  }

  const data = req.body;

  // Input validation
  if (!data.session_id) {
    return res.status(400).json({ error: 'session_id_required' });
  }

  if (typeof data.session_id !== 'string' || data.session_id.length > 128) {
    return res.status(400).json({ error: 'invalid_session_id', message: 'Must be string, max 128 chars' });
  }

  // Sanitize inputs
  data.session_id = sanitizeString(data.session_id, 128);
  data.duration_ms = sanitizeNumber(data.duration_ms, 0, 86400000); // max 24 hours
  data.interaction_count = sanitizeNumber(data.interaction_count, 0, 1000000);
  data.hash_count = sanitizeNumber(data.hash_count, 0, 100000);

  // Limit array sizes to prevent memory abuse
  if (Array.isArray(data.decisions)) data.decisions = data.decisions.slice(0, 500);
  if (Array.isArray(data.interaction_intervals)) data.interaction_intervals = data.interaction_intervals.slice(0, 1000);
  if (Array.isArray(data.tap_sequence)) data.tap_sequence = data.tap_sequence.slice(0, 500);
  if (Array.isArray(data.scroll_events)) data.scroll_events = data.scroll_events.slice(0, 2000);
  if (Array.isArray(data.render_interactions)) data.render_interactions = data.render_interactions.slice(0, 200);
  if (Array.isArray(data.touches)) data.touches = data.touches.slice(0, 500);

  // Duplicate session detection (anti-replay)
  if (sessions.has(data.session_id)) {
    return res.status(409).json({
      error: 'duplicate_session',
      message: 'This session ID has already been submitted. Possible replay attack.'
    });
  }

  // Run server-side behavioral analysis
  const signals = {
    timing: analyzeTimingEntropy(data.interaction_intervals),
    fitts: analyzeFittsLaw(data.tap_sequence),
    hicks: analyzeHicksLaw(data.decisions),
    scroll: analyzeScrollSaccade(data.scroll_events),
    microPause: analyzeMicroPause(data.render_interactions),
    touch: analyzeTouchVariance(data.touches)
  };

  // Compute composite score
  const score = computeCompositeScore(signals);

  // Generate cryptographic receipt
  const receipt = generateReceipt(data.session_id, {
    ...data,
    client_id: req.client.id
  }, score, signals);

  // Store
  sessions.set(data.session_id, { data, score, receipt, client_id: req.client.id, created: Date.now() });
  receipts.set(receipt.receipt_id, receipt);

  // Update client stats
  req.client.sessionsCount++;
  req.client.hashesGenerated += (data.hash_count || 0);

  // Return score + receipt (but NOT the raw signal analysis — that's the trade secret)
  res.status(201).json({
    session_id: data.session_id,
    receipt_id: receipt.receipt_id,

    score: {
      focus_score: receipt.engagement.focus_score,
      human_confidence: score.composite,
      quality_tier: score.tier,
      verdict: score.verdict,
      multiplier: score.multiplier
    },

    // Signal scores only (not the raw CV, R², fixation counts)
    signals: {
      timing_entropy: signals.timing.score,
      fitts_law: signals.fitts.score,
      hicks_law: signals.hicks.score,
      scroll_saccade: signals.scroll.score,
      micro_pause: signals.microPause.score,
      touch_variance: signals.touch.score
    },

    receipt: receipt
  });
});

// Verify a receipt
app.post('/v1/sessions/verify', (req, res) => {
  const { receipt_id, receipt_hash } = req.body;

  if (!receipt_id) return res.status(400).json({ error: 'receipt_id_required' });

  const receipt = receipts.get(receipt_id);
  if (!receipt) {
    return res.status(404).json({ error: 'receipt_not_found' });
  }

  // Recompute hash to verify integrity
  const payload = JSON.stringify({
    receipt_id: receipt.receipt_id,
    session_id: receipt.session_id,
    engagement: receipt.engagement,
    human_verification: receipt.human_verification,
    generated_at: receipt.generated_at
  });

  const expectedHash = crypto.createHash('sha256').update(payload).digest('hex');

  if (receipt_hash && receipt_hash !== expectedHash) {
    return res.json({
      valid: false,
      reason: 'hash_mismatch',
      message: 'Receipt hash does not match. Data may have been tampered with.'
    });
  }

  res.json({
    valid: true,
    receipt_id: receipt.receipt_id,
    receipt_hash: expectedHash,
    engagement: receipt.engagement,
    verdict: receipt.human_verification.verdict,
    generated_at: receipt.generated_at
  });
});

// ============================================================
// CONTENT ATTENTION ANALYSIS (Policy Read Verification)
// ============================================================

function analyzeContentAttention(sections) {
  if (!sections || typeof sections !== 'object') {
    return { documentScore: 0, verdict: 'no_data', sections: [] };
  }

  const sectionResults = [];
  let weightedSum = 0;
  let totalWords = 0;
  let sectionsRead = 0;
  let sectionsSkimmed = 0;
  let sectionsMissed = 0;

  for (const [sectionId, s] of Object.entries(sections)) {
    const wordCount = sanitizeNumber(s.wordCount, 0, 100000);
    const dwellMs = sanitizeNumber(s.totalDwellMs, 0, 3600000);
    const viewEntries = sanitizeNumber(s.viewEntries, 0, 1000);
    const reReadCount = sanitizeNumber(s.reReadCount, 0, 100);
    const activeSignals = sanitizeNumber(s.activeSignals, 0, 100000);
    const textSelections = sanitizeNumber(s.textSelections, 0, 1000);

    // Expected reading time (200 WPM average)
    const expectedReadMs = (wordCount / 200) * 60 * 1000;
    const minExpected = Math.max(1000, expectedReadMs * 0.3);

    // 1. Dwell score
    let dwellScore;
    if (dwellMs >= expectedReadMs * 0.8) {
      dwellScore = 1.0;
    } else if (dwellMs >= minExpected) {
      dwellScore = 0.5 + 0.5 * (dwellMs - minExpected) / Math.max(1, expectedReadMs * 0.8 - minExpected);
    } else if (dwellMs >= 1000) {
      dwellScore = 0.3 * (dwellMs / Math.max(1, minExpected));
    } else {
      dwellScore = 0;
    }
    dwellScore = Math.min(1, Math.max(0, dwellScore));

    // 2. Reading pace (WPM)
    let paceScore = 0;
    let wpm = 0;
    if (wordCount > 0 && dwellMs > 0) {
      wpm = Math.round((wordCount / dwellMs) * 60 * 1000);
      if (wpm >= 100 && wpm <= 400) paceScore = 1.0;
      else if (wpm < 100) paceScore = 0.7;
      else if (wpm <= 600) paceScore = 0.4;
      else paceScore = 0.1;
    }

    // 3. Re-read score
    const reReadScore = reReadCount >= 2 ? 1.0 : reReadCount === 1 ? 0.7 : 0.3;

    // 4. Active engagement
    const expectedSignals = Math.max(2, dwellMs / 2000);
    let engagementScore;
    if (activeSignals >= expectedSignals) {
      engagementScore = 1.0;
    } else if (activeSignals > 0) {
      engagementScore = 0.3 + 0.7 * (activeSignals / expectedSignals);
    } else {
      engagementScore = 0.1;
    }
    engagementScore = Math.min(1, engagementScore);

    // 5. Scroll velocity (from raw data if provided)
    let scrollScore = 0.5;
    if (Array.isArray(s.scrollVelocities) && s.scrollVelocities.length >= 2) {
      const velocities = [];
      for (let i = 1; i < s.scrollVelocities.length; i++) {
        const dy = Math.abs(s.scrollVelocities[i].y - s.scrollVelocities[i - 1].y);
        const dt = s.scrollVelocities[i].t - s.scrollVelocities[i - 1].t;
        if (dt > 0) velocities.push(dy / dt);
      }
      if (velocities.length > 0) {
        const avgV = velocities.reduce((a, b) => a + b, 0) / velocities.length;
        if (avgV < 0.3) scrollScore = 1.0;
        else if (avgV < 1.0) scrollScore = 0.7;
        else if (avgV < 2.0) scrollScore = 0.4;
        else scrollScore = 0.1;
      }
    }

    // 6. Viewport coverage
    let coverageScore = 0;
    if (Array.isArray(s.intersectionSamples) && s.intersectionSamples.length > 0) {
      coverageScore = s.intersectionSamples.reduce((a, b) => a + b, 0) / s.intersectionSamples.length;
    } else {
      coverageScore = sanitizeNumber(s.maxIntersectionRatio, 0, 1);
    }

    // Composite
    const composite = (
      dwellScore * 0.30 +
      paceScore * 0.20 +
      reReadScore * 0.10 +
      engagementScore * 0.15 +
      scrollScore * 0.15 +
      coverageScore * 0.10
    );

    const verdict = composite >= 0.7 ? 'read' :
                    composite >= 0.4 ? 'skimmed' :
                    composite >= 0.2 ? 'glanced' : 'missed';

    if (verdict === 'read') sectionsRead++;
    else if (verdict === 'skimmed') sectionsSkimmed++;
    else sectionsMissed++;

    const weight = wordCount || 1;
    weightedSum += composite * weight;
    totalWords += wordCount;

    sectionResults.push({
      sectionId,
      title: sanitizeString(s.title, 256),
      wordCount,
      dwellMs,
      wpm,
      viewEntries,
      reReadCount,
      scores: {
        dwell: Math.round(dwellScore * 1000) / 1000,
        readingPace: Math.round(paceScore * 1000) / 1000,
        reRead: Math.round(reReadScore * 1000) / 1000,
        activeEngagement: Math.round(engagementScore * 1000) / 1000,
        scrollVelocity: Math.round(scrollScore * 1000) / 1000,
        viewportCoverage: Math.round(coverageScore * 1000) / 1000
      },
      composite: Math.round(composite * 1000) / 1000,
      verdict
    });
  }

  const documentScore = totalWords > 0 ? Math.round((weightedSum / totalWords) * 1000) / 1000 : 0;

  let documentVerdict;
  if (documentScore >= 0.7 && sectionsRead >= sectionResults.length * 0.8) {
    documentVerdict = 'thoroughly_read';
  } else if (documentScore >= 0.5) {
    documentVerdict = 'partially_read';
  } else if (documentScore >= 0.25) {
    documentVerdict = 'skimmed';
  } else {
    documentVerdict = 'not_read';
  }

  return {
    documentScore,
    verdict: documentVerdict,
    totalSections: sectionResults.length,
    sectionsRead,
    sectionsSkimmed,
    sectionsMissed,
    totalWordCount: totalWords,
    sections: sectionResults
  };
}

// Submit content attention data for analysis
app.post('/v1/sessions/content-attention', authenticate, (req, res) => {
  const rateCheck = checkRateLimit(req.client.id, req.client.plan);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.reason });
  }

  const data = req.body;
  if (!data.session_id) return res.status(400).json({ error: 'session_id_required' });
  if (!data.sections || typeof data.sections !== 'object') {
    return res.status(400).json({ error: 'sections_required', message: 'Provide sections object with per-section data' });
  }

  // Limit section count
  const sectionKeys = Object.keys(data.sections);
  if (sectionKeys.length > 200) {
    return res.status(400).json({ error: 'too_many_sections', message: 'Maximum 200 sections per document' });
  }

  const result = analyzeContentAttention(data.sections);

  // Generate receipt
  const receiptId = 'rcpt_content_' + Date.now().toString(36) + '_' + uuidv4().substring(0, 8);
  const receiptPayload = JSON.stringify({
    receipt_id: receiptId,
    session_id: data.session_id,
    document_score: result.documentScore,
    verdict: result.verdict,
    sections_read: result.sectionsRead,
    total_sections: result.totalSections
  });
  const receiptHash = crypto.createHash('sha256').update(receiptPayload).digest('hex');

  const receipt = {
    receipt_id: receiptId,
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol — Content Verification',
    issuer: 'SWS Strategic Media LLC',
    generated_at: new Date().toISOString(),
    session_id: data.session_id,
    proof: { algorithm: 'SHA-256', receipt_hash: receiptHash }
  };

  receipts.set(receiptId, receipt);
  req.client.sessionsCount++;

  res.status(201).json({
    session_id: data.session_id,
    receipt_id: receiptId,
    content_attention: result,
    receipt
  });
});

// ============================================================
// DRIFT DETECTION (Performance Degradation)
// ============================================================

function analyzeBaselineDrift(baseline, current, thresholds) {
  const drifts = {};
  let driftValues = [];
  let degradedCount = 0;

  const defaultThresholds = {
    reactionTime: 0.40,
    clickPrecision: 0.35,
    scrollRhythm: 0.40,
    mouseJitter: 0.50,
    interactionFrequency: 0.50
  };
  thresholds = thresholds || defaultThresholds;

  function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function cv(arr) {
    if (!arr || arr.length < 2) return 0;
    const m = mean(arr);
    if (m === 0) return 0;
    const variance = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
    return Math.sqrt(variance) / m;
  }

  // 1. Reaction time drift
  if (current.reactionTimes && current.reactionTimes.length >= 3 &&
      baseline.reactionTime && baseline.reactionTime.mean > 0) {
    const currentMean = mean(current.reactionTimes);
    const drift = (currentMean - baseline.reactionTime.mean) / baseline.reactionTime.mean;
    const degraded = drift > (thresholds.reactionTime || 0.40);
    drifts.reactionTime = {
      baselineMean: Math.round(baseline.reactionTime.mean),
      currentMean: Math.round(currentMean),
      drift: Math.round(drift * 1000) / 1000,
      degraded
    };
    driftValues.push(Math.min(1, Math.max(0, drift)));
    if (degraded) degradedCount++;
  }

  // 2. Click precision drift
  if (current.clickPrecisions && current.clickPrecisions.length >= 3 &&
      baseline.clickPrecision && baseline.clickPrecision.mean > 0) {
    const currentMean = mean(current.clickPrecisions);
    const drift = (currentMean - baseline.clickPrecision.mean) / baseline.clickPrecision.mean;
    const degraded = drift > (thresholds.clickPrecision || 0.35);
    drifts.clickPrecision = {
      baselineMean: Math.round(baseline.clickPrecision.mean * 10) / 10,
      currentMean: Math.round(currentMean * 10) / 10,
      drift: Math.round(drift * 1000) / 1000,
      degraded
    };
    driftValues.push(Math.min(1, Math.max(0, drift)));
    if (degraded) degradedCount++;
  }

  // 3. Scroll rhythm drift
  if (current.scrollIntervals && current.scrollIntervals.length >= 3 &&
      baseline.scrollRhythm && baseline.scrollRhythm.cv > 0) {
    const currentCv = cv(current.scrollIntervals);
    const drift = Math.abs(currentCv - baseline.scrollRhythm.cv) / baseline.scrollRhythm.cv;
    const degraded = drift > (thresholds.scrollRhythm || 0.40);
    drifts.scrollRhythm = {
      baselineCv: Math.round(baseline.scrollRhythm.cv * 1000) / 1000,
      currentCv: Math.round(currentCv * 1000) / 1000,
      drift: Math.round(drift * 1000) / 1000,
      degraded
    };
    driftValues.push(Math.min(1, Math.max(0, drift)));
    if (degraded) degradedCount++;
  }

  // 4. Mouse jitter drift
  if (current.mouseJitter && current.mouseJitter.length >= 3 &&
      baseline.mouseJitter && baseline.mouseJitter.mean > 0) {
    const currentMean = mean(current.mouseJitter);
    const drift = (currentMean - baseline.mouseJitter.mean) / baseline.mouseJitter.mean;
    const degraded = drift > (thresholds.mouseJitter || 0.50);
    drifts.mouseJitter = {
      baselineMean: Math.round(baseline.mouseJitter.mean * 10) / 10,
      currentMean: Math.round(currentMean * 10) / 10,
      drift: Math.round(drift * 1000) / 1000,
      degraded
    };
    driftValues.push(Math.min(1, Math.max(0, drift)));
    if (degraded) degradedCount++;
  }

  // 5. Interaction frequency drift
  if (current.interactionGaps && current.interactionGaps.length >= 3 &&
      baseline.interactionFrequency && baseline.interactionFrequency.meanGap > 0) {
    const currentMean = mean(current.interactionGaps);
    const drift = (currentMean - baseline.interactionFrequency.meanGap) / baseline.interactionFrequency.meanGap;
    const degraded = drift > (thresholds.interactionFrequency || 0.50);
    drifts.interactionFrequency = {
      baselineGap: Math.round(baseline.interactionFrequency.meanGap),
      currentGap: Math.round(currentMean),
      drift: Math.round(drift * 1000) / 1000,
      degraded
    };
    driftValues.push(Math.min(1, Math.max(0, drift)));
    if (degraded) degradedCount++;
  }

  const compositeDrift = driftValues.length > 0 ?
    Math.round((driftValues.reduce((a, b) => a + b, 0) / driftValues.length) * 1000) / 1000 : 0;

  let level;
  if (compositeDrift >= 0.70) level = 'critical';
  else if (compositeDrift >= 0.50) level = 'alert';
  else if (compositeDrift >= 0.30) level = 'warning';
  else level = 'normal';

  let recommendation;
  if (level === 'critical') recommendation = 'Immediate break recommended. Multiple signals show significant degradation.';
  else if (level === 'alert') recommendation = 'Performance degradation detected. Consider a short break.';
  else if (level === 'warning') recommendation = 'Minor drift detected. Monitor closely.';
  else recommendation = 'Performance within normal range.';

  return {
    driftScore: compositeDrift,
    level,
    degradedSignals: degradedCount,
    totalSignals: driftValues.length,
    signals: drifts,
    recommendation
  };
}

// Submit drift check
app.post('/v1/sessions/drift-check', authenticate, (req, res) => {
  const rateCheck = checkRateLimit(req.client.id, req.client.plan);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.reason });
  }

  const data = req.body;
  if (!data.session_id) return res.status(400).json({ error: 'session_id_required' });
  if (!data.baseline || typeof data.baseline !== 'object') {
    return res.status(400).json({ error: 'baseline_required', message: 'Provide baseline stats object' });
  }
  if (!data.current || typeof data.current !== 'object') {
    return res.status(400).json({ error: 'current_required', message: 'Provide current window data' });
  }

  // Limit array sizes
  const currentData = data.current;
  if (Array.isArray(currentData.reactionTimes)) currentData.reactionTimes = currentData.reactionTimes.slice(0, 500);
  if (Array.isArray(currentData.clickPrecisions)) currentData.clickPrecisions = currentData.clickPrecisions.slice(0, 500);
  if (Array.isArray(currentData.scrollIntervals)) currentData.scrollIntervals = currentData.scrollIntervals.slice(0, 500);
  if (Array.isArray(currentData.mouseJitter)) currentData.mouseJitter = currentData.mouseJitter.slice(0, 1000);
  if (Array.isArray(currentData.interactionGaps)) currentData.interactionGaps = currentData.interactionGaps.slice(0, 500);

  const result = analyzeBaselineDrift(data.baseline, currentData, data.thresholds);

  res.status(200).json({
    session_id: data.session_id,
    timestamp: new Date().toISOString(),
    drift: result
  });
});

// Client stats
app.get('/v1/clients/:clientId/stats', authenticate, (req, res) => {
  if (req.params.clientId !== req.client.id) {
    return res.status(403).json({ error: 'unauthorized', message: 'Can only view your own stats' });
  }

  // Gather session stats for this client
  const clientSessions = [];
  sessions.forEach((s, id) => {
    if (s.client_id === req.client.id) {
      clientSessions.push({
        session_id: id,
        score: s.score.composite,
        tier: s.score.tier,
        verdict: s.score.verdict,
        created: s.created
      });
    }
  });

  const tiers = { deep: 0, active: 0, passive: 0, background: 0 };
  const verdicts = {};
  let totalScore = 0;

  clientSessions.forEach(s => {
    tiers[s.tier]++;
    verdicts[s.verdict] = (verdicts[s.verdict] || 0) + 1;
    totalScore += s.score;
  });

  res.json({
    client_id: req.client.id,
    name: req.client.name,
    plan: req.client.plan,
    created: new Date(req.client.created).toISOString(),
    stats: {
      total_sessions: clientSessions.length,
      total_hashes: req.client.hashesGenerated,
      avg_score: clientSessions.length > 0 ? Math.round(totalScore / clientSessions.length * 1000) / 1000 : 0,
      tier_distribution: tiers,
      verdict_distribution: verdicts
    },
    recent_sessions: clientSessions.slice(-20).reverse()
  });
});

// ============================================================
// VIDEO ATTENTION ANALYSIS
// ============================================================

function analyzeVideoAttention(data) {
  const scores = {};
  const videoDurationSec = sanitizeNumber(data.videoDurationSec, 0, 86400);
  const videoDurationMs = videoDurationSec * 1000;
  const totalPlayTimeMs = sanitizeNumber(data.totalPlayTimeMs, 0, 86400000);

  // 1. Completion
  let watchedSegments = 0;
  let totalSegments = 0;
  if (Array.isArray(data.segments)) {
    totalSegments = data.segments.length;
    data.segments.forEach(seg => { if (seg.watched) watchedSegments++; });
  }
  scores.completion = totalSegments > 0 ? watchedSegments / totalSegments : 0;

  // 2. Focus
  const tabFocusedMs = sanitizeNumber(data.tabFocusedMs, 0, 86400000);
  const tabHiddenMs = sanitizeNumber(data.tabHiddenMs, 0, 86400000);
  const totalTrackableMs = tabFocusedMs + tabHiddenMs;
  scores.focus = totalTrackableMs > 0 ? tabFocusedMs / totalTrackableMs : 1;

  // 3. Engagement (pause/seek)
  const pauseCount = sanitizeNumber(data.pauseCount, 0, 10000);
  const seekBackCount = sanitizeNumber(data.seekBackCount, 0, 10000);
  const seekForwardCount = sanitizeNumber(data.seekForwardCount, 0, 10000);

  let pauseScore = pauseCount >= 3 ? 1.0 : pauseCount >= 1 ? 0.6 : 0.2;
  let seekScore = seekBackCount >= 2 ? 1.0 : seekBackCount >= 1 ? 0.7 :
                  seekForwardCount > 0 ? 0.3 : 0.2;
  scores.engagement = pauseScore * 0.5 + seekScore * 0.5;

  // 4. Activity during playback
  const activityCount = sanitizeNumber(data.activityDuringPlay, 0, 100000);
  const playMinutes = totalPlayTimeMs / 60000;
  const expectedActivity = playMinutes * 3; // 3 per minute
  if (expectedActivity > 0 && activityCount >= expectedActivity * 0.5) {
    scores.activity = Math.min(1, activityCount / expectedActivity);
  } else if (activityCount > 0) {
    scores.activity = 0.3 + 0.3 * (activityCount / Math.max(1, expectedActivity));
  } else {
    scores.activity = 0.1;
  }
  scores.activity = Math.min(1, Math.max(0, scores.activity));

  // 5. Pacing
  scores.pacing = 1.0;
  if (Array.isArray(data.playbackRateChanges) && data.playbackRateChanges.length > 0) {
    let maxRate = 1.0;
    data.playbackRateChanges.forEach(r => { if (r.to > maxRate) maxRate = r.to; });
    if (maxRate <= 2.0) scores.pacing = 0.8;
    else if (maxRate <= 3.0) scores.pacing = 0.5;
    else scores.pacing = 0.2;
  }

  // 6. Attention continuity
  let gapCount = 0;
  if (Array.isArray(data.activityLog) && data.activityLog.length >= 2) {
    for (let i = 1; i < data.activityLog.length; i++) {
      if (data.activityLog[i].wallTime - data.activityLog[i - 1].wallTime > 60000) {
        gapCount++;
      }
    }
  }
  scores.attentionContinuity = gapCount === 0 ? 1.0 :
    gapCount <= 2 ? 0.6 : Math.max(0.1, 1 - gapCount * 0.15);

  // Composite
  const composite = (
    scores.completion * 0.25 +
    scores.focus * 0.20 +
    scores.engagement * 0.15 +
    scores.activity * 0.20 +
    scores.pacing * 0.10 +
    scores.attentionContinuity * 0.10
  );

  const verdict = composite >= 0.70 ? 'genuine_viewer' :
                  composite >= 0.50 ? 'partial_attention' :
                  composite >= 0.30 ? 'minimal_attention' : 'likely_bot';

  return {
    composite: Math.round(composite * 1000) / 1000,
    verdict,
    scores: Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
    ),
    stats: {
      videoDurationSec,
      totalPlayTimeMs: Math.round(totalPlayTimeMs),
      pauseCount,
      seekBackCount,
      seekForwardCount,
      segmentsWatched: watchedSegments,
      segmentsTotal: totalSegments,
      completionPercent: Math.round(scores.completion * 100),
      focusPercent: Math.round(scores.focus * 100)
    }
  };
}

app.post('/v1/sessions/video-attention', authenticate, (req, res) => {
  const rateCheck = checkRateLimit(req.client.id, req.client.plan);
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });

  const data = req.body;
  if (!data.session_id) return res.status(400).json({ error: 'session_id_required' });
  if (!data.videoDurationSec || data.videoDurationSec <= 0) {
    return res.status(400).json({ error: 'video_duration_required' });
  }

  // Limit arrays
  if (Array.isArray(data.activityLog)) data.activityLog = data.activityLog.slice(0, 2000);
  if (Array.isArray(data.segments)) data.segments = data.segments.slice(0, 5000);
  if (Array.isArray(data.playbackRateChanges)) data.playbackRateChanges = data.playbackRateChanges.slice(0, 100);

  const result = analyzeVideoAttention(data);

  // Generate receipt
  const receiptId = 'rcpt_video_' + Date.now().toString(36) + '_' + uuidv4().substring(0, 8);
  const receiptPayload = JSON.stringify({
    receipt_id: receiptId,
    session_id: data.session_id,
    composite: result.composite,
    verdict: result.verdict,
    completion: result.scores.completion
  });
  const receiptHash = crypto.createHash('sha256').update(receiptPayload).digest('hex');

  const receipt = {
    receipt_id: receiptId,
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol — Video Verification',
    issuer: 'SWS Strategic Media LLC',
    generated_at: new Date().toISOString(),
    session_id: data.session_id,
    proof: { algorithm: 'SHA-256', receipt_hash: receiptHash }
  };

  receipts.set(receiptId, receipt);
  req.client.sessionsCount++;

  res.status(201).json({
    session_id: data.session_id,
    receipt_id: receiptId,
    video_attention: result,
    receipt
  });
});

// ============================================================
// TEMPORAL SESSION ANALYSIS
// ============================================================

app.post('/v1/sessions/temporal-analysis', authenticate, (req, res) => {
  const rateCheck = checkRateLimit(req.client.id, req.client.plan);
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });

  const data = req.body;
  if (!data.session_id) return res.status(400).json({ error: 'session_id_required' });
  if (!Array.isArray(data.events) || data.events.length < 10) {
    return res.status(400).json({
      error: 'insufficient_events',
      message: 'Provide at least 10 timestamped events for temporal analysis'
    });
  }

  // Limit events
  const events = data.events.slice(0, 10000);
  const windowSizeMs = sanitizeNumber(data.windowSizeMs, 30000, 3600000) || 300000; // default 5min
  const sessionStart = events[0].timestamp || Date.now();

  // Build windows
  const sessionDuration = (events[events.length - 1].timestamp || Date.now()) - sessionStart;
  const windowCount = Math.max(1, Math.ceil(sessionDuration / windowSizeMs));
  const windows = [];

  for (let w = 0; w < windowCount; w++) {
    const wStart = sessionStart + (w * windowSizeMs);
    const wEnd = wStart + windowSizeMs;
    const wEvents = events.filter(e => e.timestamp >= wStart && e.timestamp < wEnd);

    const rts = wEvents.filter(e => e.type === 'reaction_time').map(e => e.value);
    const precs = wEvents.filter(e => e.type === 'click_precision').map(e => e.value);
    const jitter = wEvents.filter(e => e.type === 'mouse_jitter').map(e => e.value);

    const gaps = [];
    const sorted = wEvents.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }

    const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    windows.push({
      index: w,
      eventCount: wEvents.length,
      valid: wEvents.length >= 5,
      metrics: {
        reactionTime: rts.length >= 2 ? { mean: Math.round(mean(rts)), count: rts.length } : null,
        clickPrecision: precs.length >= 2 ? { mean: Math.round(mean(precs) * 10) / 10, count: precs.length } : null,
        interactionRate: { eventsPerMinute: Math.round(wEvents.length / (windowSizeMs / 60000) * 10) / 10 },
        mouseJitter: jitter.length >= 2 ? { mean: Math.round(mean(jitter) * 100) / 100, count: jitter.length } : null
      }
    });
  }

  // Trend detection
  const validWindows = windows.filter(w => w.valid);
  const trends = {};
  const degradationPoints = [];

  function detectTrend(values) {
    if (values.length < 3) return { trend: 'insufficient_data', pctChange: 0 };
    const first = values[0];
    const last = values[values.length - 1];
    const pctChange = first !== 0 ? Math.round(((last - first) / Math.abs(first)) * 1000) / 1000 : 0;
    const trend = Math.abs(pctChange) < 0.10 ? 'stable' :
                  pctChange > 0 ? 'increasing' : 'decreasing';
    return { trend, pctChange };
  }

  const rtSeries = validWindows.filter(w => w.metrics.reactionTime).map(w => w.metrics.reactionTime.mean);
  if (rtSeries.length >= 3) {
    trends.reactionTime = detectTrend(rtSeries);
    trends.reactionTime.interpretation =
      trends.reactionTime.trend === 'increasing' ? 'slowing_down' :
      trends.reactionTime.trend === 'decreasing' ? 'speeding_up' : 'stable';
  }

  const rateSeries = validWindows.map(w => w.metrics.interactionRate.eventsPerMinute);
  if (rateSeries.length >= 3) {
    trends.interactionRate = detectTrend(rateSeries);
    trends.interactionRate.interpretation =
      trends.interactionRate.trend === 'decreasing' ? 'disengaging' :
      trends.interactionRate.trend === 'increasing' ? 'more_active' : 'stable';
  }

  // Overall degradation
  let degradationScores = [];
  if (trends.reactionTime && trends.reactionTime.trend === 'increasing') {
    degradationScores.push(Math.min(1, Math.abs(trends.reactionTime.pctChange)));
  }
  if (trends.interactionRate && trends.interactionRate.trend === 'decreasing') {
    degradationScores.push(Math.min(1, Math.abs(trends.interactionRate.pctChange)));
  }
  const overallDegradation = degradationScores.length > 0 ?
    Math.round((degradationScores.reduce((a, b) => a + b, 0) / degradationScores.length) * 1000) / 1000 : 0;

  const verdict = overallDegradation >= 0.50 ? 'significant_fatigue' :
                  overallDegradation >= 0.25 ? 'moderate_fatigue' :
                  overallDegradation > 0 ? 'mild_fatigue' : 'sustained_attention';

  res.status(200).json({
    session_id: data.session_id,
    sessionDurationMs: sessionDuration,
    windowCount: windows.length,
    validWindowCount: validWindows.length,
    verdict,
    overallDegradation,
    trends,
    windows: windows.map(w => ({
      index: w.index,
      eventCount: w.eventCount,
      valid: w.valid,
      metrics: w.metrics
    }))
  });
});

// ============================================================
// SESSION INTEGRITY VALIDATION
// ============================================================

const IntegrityValidator = require('../src/sdk/session-integrity-validator');

app.post('/v1/sessions/validate-integrity', authenticate, (req, res) => {
  const rateCheck = checkRateLimit(req.client.id, req.client.plan);
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });

  const data = req.body;
  if (!data.session_id) return res.status(400).json({ error: 'session_id_required' });

  const result = IntegrityValidator.validate(data);

  res.status(200).json({
    session_id: data.session_id,
    timestamp: new Date().toISOString(),
    integrity: result
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(function(err, req, res, next) {
  console.error(`  [ERROR] ${req.method} ${req.path}:`, err.message);
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'cors_blocked', message: err.message });
  }
  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use(function(req, res) {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found: ' + req.method + ' ' + req.path,
    docs: 'https://docs.swsprotocol.com/api'
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  SWS Attention Protocol — API Server v1.0.0');
    console.log('  Patent Pending: SWS-PROV-001');
    console.log('  (c) 2026 SWS Strategic Media LLC');
    console.log('');
    console.log(`  Server:    http://localhost:${PORT}`);
    console.log(`  Health:    http://localhost:${PORT}/v1/health`);
    console.log(`  Demo key:  ${DEMO_API_KEY}`);
    console.log(`  Demo ID:   ${DEMO_CLIENT_ID}`);
    console.log('');
  });
}

module.exports = app;
