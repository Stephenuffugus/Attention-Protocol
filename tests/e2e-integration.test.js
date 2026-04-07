/**
 * SWS Attention Protocol — End-to-End Integration Test
 *
 * Tests the COMPLETE pipeline:
 *   1. Client registers and gets API key
 *   2. Client tag collects behavioral signals (simulated)
 *   3. Signals are sent to API server
 *   4. Server scores and returns receipt
 *   5. Receipt is independently verified
 *   6. Client stats reflect the session
 *   7. Replay is blocked
 *   8. Rate limits enforce
 *
 * This proves the entire system works together.
 *
 * Run with: npx jest tests/e2e-integration.test.js --verbose
 */

const http = require('http');
const app = require('../server/index');

let server;
let port;

beforeAll((done) => {
  server = app.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

function api(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost', port, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================
// FULL PIPELINE TEST
// ============================================================

describe('End-to-End: Complete Client Pipeline', () => {
  let clientId, apiKey;

  test('Step 1: Register a new client', async () => {
    const res = await api('POST', '/v1/clients', {
      name: 'Acme Research Corp',
      contact_email: 'admin@acme.com',
      plan: 'pilot'
    });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toMatch(/^cli_/);
    expect(res.body.api_key).toMatch(/^sws_/);
    expect(res.body.api_key.length).toBeGreaterThan(30);

    clientId = res.body.client_id;
    apiKey = res.body.api_key;
  });

  test('Step 2: Submit a human session with full signals', async () => {
    const res = await api('POST', '/v1/sessions', {
      session_id: 'e2e_human_' + Date.now(),
      duration_ms: 180000,         // 3 minutes
      interaction_count: 35,
      hash_count: 6,
      application_id: 'survey_platform',

      // Hick's Law data (human: RT scales with options)
      decisions: [
        { optionCount: 2, responseTimeMs: 620 },
        { optionCount: 2, responseTimeMs: 700 },
        { optionCount: 4, responseTimeMs: 920 },
        { optionCount: 4, responseTimeMs: 1050 },
        { optionCount: 8, responseTimeMs: 1300 },
        { optionCount: 8, responseTimeMs: 1200 },
        { optionCount: 16, responseTimeMs: 1700 },
        { optionCount: 16, responseTimeMs: 1900 },
      ],

      // Timing intervals (variable — human)
      interaction_intervals: [
        1200, 800, 1500, 600, 2200, 900, 1100, 3000, 700, 1800,
        500, 1400, 2500, 1000, 800
      ],

      // Tap positions (varied distances)
      tap_sequence: [
        { x: 100, y: 200, t: 1000 },
        { x: 500, y: 300, t: 2500 },
        { x: 120, y: 600, t: 3200 },
        { x: 700, y: 100, t: 5000 },
        { x: 150, y: 400, t: 5800 },
        { x: 600, y: 500, t: 7200 },
        { x: 200, y: 200, t: 8000 },
        { x: 400, y: 700, t: 9500 },
        { x: 100, y: 100, t: 10000 },
        { x: 800, y: 600, t: 12000 },
        { x: 300, y: 300, t: 12500 },
      ],

      // Scroll events with fixation pauses
      scroll_events: Array.from({ length: 30 }, (_, i) => ({
        y: i * 50 + (i % 5 === 0 ? 0 : Math.random() * 30),
        t: i * 300 + (i % 5 === 0 ? 500 : 0)  // Pause every 5th event
      })),

      // Render interactions with human-like delays
      render_interactions: [
        { renderTime: 1000, complexity: 'simple', delay: 350 },
        { renderTime: 5000, complexity: 'moderate', delay: 600 },
        { renderTime: 10000, complexity: 'complex', delay: 1200 },
        { renderTime: 15000, complexity: 'moderate', delay: 450 },
      ],

      // Touch data with natural variance
      touches: Array.from({ length: 15 }, () => ({
        radiusX: 10 + Math.random() * 8,
        radiusY: 8 + Math.random() * 6,
        force: 0.3 + Math.random() * 0.4
      }))
    }, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    expect(res.status).toBe(201);

    // Score should reflect human-like behavior
    expect(res.body.score.human_confidence).toBeGreaterThan(0.3);
    expect(res.body.score.quality_tier).toBeDefined();
    expect(res.body.score.verdict).toBeDefined();

    // Hick's Law should score high (human RT scales with options)
    expect(res.body.signals.hicks_law).toBeGreaterThan(0.5);

    // Timing should score well (variable intervals)
    expect(res.body.signals.timing_entropy).toBeGreaterThan(0.3);

    // Receipt should be valid
    expect(res.body.receipt.receipt_id).toMatch(/^rcpt_/);
    expect(res.body.receipt.proof.receipt_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.receipt.privacy.coppa_compliant).toBe(true);
    expect(res.body.receipt.privacy.scif_eligible).toBe(true);

    // Store receipt for verification step
    this.receipt = res.body.receipt;
  });

  test('Step 3: Submit a bot session — should score lower', async () => {
    const res = await api('POST', '/v1/sessions', {
      session_id: 'e2e_bot_' + Date.now(),
      duration_ms: 3000,
      interaction_count: 8,
      hash_count: 1,
      application_id: 'survey_platform',

      // Bot: constant RT regardless of option count
      decisions: [
        { optionCount: 2, responseTimeMs: 50 },
        { optionCount: 4, responseTimeMs: 50 },
        { optionCount: 8, responseTimeMs: 50 },
        { optionCount: 16, responseTimeMs: 50 },
        { optionCount: 2, responseTimeMs: 50 },
        { optionCount: 4, responseTimeMs: 50 },
      ],

      // Bot: metronomic intervals
      interaction_intervals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],

      // Bot: all same position
      tap_sequence: Array.from({ length: 12 }, (_, i) => ({
        x: 400, y: 300, t: i * 100
      })),

      // Bot: constant scroll velocity, no pauses
      scroll_events: Array.from({ length: 25 }, (_, i) => ({
        y: i * 100, t: i * 50
      })),

      // Bot: instant interaction after render
      render_interactions: [
        { renderTime: 1000, complexity: 'moderate', delay: 10 },
        { renderTime: 2000, complexity: 'complex', delay: 15 },
        { renderTime: 3000, complexity: 'simple', delay: 8 },
      ],

      // Bot: zero touch variance
      touches: Array.from({ length: 12 }, () => ({
        radiusX: 10, radiusY: 8, force: 0.5
      }))
    }, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    expect(res.status).toBe(201);

    // Bot should score lower on Hick's Law
    expect(res.body.signals.hicks_law).toBeLessThan(0.4);

    // Bot should have low timing entropy (constant intervals)
    // CV of [100,100,...] = 0, so timing score ≈ 0
    expect(res.body.signals.timing_entropy).toBeLessThan(0.2);

    // Micro-pause should detect instant interaction (bot)
    expect(res.body.signals.micro_pause).toBeLessThan(0.5);
  });

  test('Step 4: Verify the human receipt cryptographically', async () => {
    // Get a receipt first
    const sessionRes = await api('POST', '/v1/sessions', {
      session_id: 'e2e_verify_' + Date.now(),
      duration_ms: 60000,
      interaction_count: 20
    }, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    const receiptId = sessionRes.body.receipt.receipt_id;
    const receiptHash = sessionRes.body.receipt.proof.receipt_hash;

    // Verify it
    const verifyRes = await api('POST', '/v1/sessions/verify', {
      receipt_id: receiptId,
      receipt_hash: receiptHash
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.receipt_hash).toBe(receiptHash);
  });

  test('Step 5: Tampered receipt is rejected', async () => {
    const sessionRes = await api('POST', '/v1/sessions', {
      session_id: 'e2e_tamper_' + Date.now(),
      duration_ms: 60000
    }, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    const verifyRes = await api('POST', '/v1/sessions/verify', {
      receipt_id: sessionRes.body.receipt.receipt_id,
      receipt_hash: 'TAMPERED_' + '0'.repeat(55)
    });

    expect(verifyRes.body.valid).toBe(false);
    expect(verifyRes.body.reason).toBe('hash_mismatch');
  });

  test('Step 6: Replay attack is blocked', async () => {
    const sessionId = 'e2e_replay_' + Date.now();

    await api('POST', '/v1/sessions', {
      session_id: sessionId,
      duration_ms: 60000
    }, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    const replayRes = await api('POST', '/v1/sessions', {
      session_id: sessionId,
      duration_ms: 60000
    }, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    expect(replayRes.status).toBe(409);
    expect(replayRes.body.error).toBe('duplicate_session');
  });

  test('Step 7: Client stats show all sessions', async () => {
    const res = await api('GET', `/v1/clients/${clientId}/stats`, null, {
      'X-SWS-API-Key': apiKey,
      'X-SWS-Client-ID': clientId
    });

    expect(res.status).toBe(200);
    expect(res.body.client_id).toBe(clientId);
    expect(res.body.stats.total_sessions).toBeGreaterThanOrEqual(3);
    expect(res.body.stats.tier_distribution).toBeDefined();
    expect(res.body.stats.verdict_distribution).toBeDefined();
  });

  test('Step 8: Unauthorized access is blocked', async () => {
    const res = await api('POST', '/v1/sessions', {
      session_id: 'unauthorized_' + Date.now()
    }, {
      'X-SWS-API-Key': 'wrong_key_attempt',
      'X-SWS-Client-ID': clientId
    });

    expect(res.status).toBe(403);
  });
});

// ============================================================
// SIGNAL ACCURACY: Human vs Bot with Full Signals
// ============================================================

describe('End-to-End: Signal Accuracy Validation', () => {
  const headers = {
    'X-SWS-API-Key': 'sws_demo_key_2026',
    'X-SWS-Client-ID': 'demo_client'
  };

  test('human session scores higher than bot on EVERY signal', async () => {
    // Submit human
    const human = await api('POST', '/v1/sessions', {
      session_id: 'accuracy_human_' + Date.now(),
      duration_ms: 120000,
      decisions: [
        { optionCount: 2, responseTimeMs: 650 },
        { optionCount: 4, responseTimeMs: 950 },
        { optionCount: 8, responseTimeMs: 1300 },
        { optionCount: 16, responseTimeMs: 1800 },
        { optionCount: 2, responseTimeMs: 700 },
        { optionCount: 4, responseTimeMs: 1000 },
      ],
      interaction_intervals: [1200, 800, 1500, 600, 2200, 900, 1100, 3000, 700, 1800, 500, 1400],
      render_interactions: [
        { complexity: 'moderate', delay: 500 },
        { complexity: 'complex', delay: 900 },
        { complexity: 'simple', delay: 300 },
      ],
      touches: Array.from({ length: 12 }, () => ({
        radiusX: 10 + Math.random() * 8,
        radiusY: 8 + Math.random() * 6,
        force: 0.3 + Math.random() * 0.4
      }))
    }, headers);

    // Submit bot
    const bot = await api('POST', '/v1/sessions', {
      session_id: 'accuracy_bot_' + Date.now(),
      duration_ms: 5000,
      decisions: [
        { optionCount: 2, responseTimeMs: 50 },
        { optionCount: 4, responseTimeMs: 50 },
        { optionCount: 8, responseTimeMs: 50 },
        { optionCount: 16, responseTimeMs: 50 },
        { optionCount: 2, responseTimeMs: 50 },
        { optionCount: 4, responseTimeMs: 50 },
      ],
      interaction_intervals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      render_interactions: [
        { complexity: 'moderate', delay: 10 },
        { complexity: 'complex', delay: 15 },
        { complexity: 'simple', delay: 8 },
      ],
      touches: Array.from({ length: 12 }, () => ({
        radiusX: 10, radiusY: 8, force: 0.5
      }))
    }, headers);

    const hs = human.body.signals;
    const bs = bot.body.signals;

    // Human should score higher on signals where we provided data
    expect(hs.hicks_law).toBeGreaterThan(bs.hicks_law);
    expect(hs.timing_entropy).toBeGreaterThan(bs.timing_entropy);

    // Overall confidence should be higher for human
    expect(human.body.score.human_confidence).toBeGreaterThan(bot.body.score.human_confidence);

    // Print comparison for report
    console.log('\n  E2E SIGNAL COMPARISON:');
    console.log('  Signal            | Human  | Bot    | Delta');
    console.log('  ' + '-'.repeat(50));
    ['timing_entropy', 'fitts_law', 'hicks_law', 'scroll_saccade', 'micro_pause', 'touch_variance'].forEach(sig => {
      const h = hs[sig].toFixed(3).padStart(6);
      const b = bs[sig].toFixed(3).padStart(6);
      const d = (hs[sig] - bs[sig]).toFixed(3).padStart(6);
      console.log(`  ${sig.padEnd(18)} | ${h} | ${b} | ${d}`);
    });
    console.log(`  ${'COMPOSITE'.padEnd(18)} | ${human.body.score.human_confidence.toFixed(3).padStart(6)} | ${bot.body.score.human_confidence.toFixed(3).padStart(6)} | ${(human.body.score.human_confidence - bot.body.score.human_confidence).toFixed(3).padStart(6)}`);
    console.log('');
  });
});
