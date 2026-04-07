/**
 * SWS Attention Protocol — API Server Tests
 *
 * Tests the server-side scoring engine, receipt generation,
 * replay protection, and client management.
 *
 * Run with: npx jest tests/api-server.test.js --verbose
 */

const http = require('http');
const app = require('../server/index');

let server;
let baseUrl;

beforeAll((done) => {
  server = app.listen(0, () => {
    baseUrl = `http://localhost:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

function apiRequest(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: JSON.parse(data)
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const DEMO_HEADERS = {
  'X-SWS-API-Key': 'sws_demo_key_2026',
  'X-SWS-Client-ID': 'demo_client'
};

// ============================================================
// Health Check
// ============================================================

describe('Health Check', () => {
  test('GET /v1/health returns server info', async () => {
    const res = await apiRequest('GET', '/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.protocol).toBe('SWS Proof of Attention Protocol');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.patent).toBe('SWS-PROV-001');
  });
});

// ============================================================
// Client Registration
// ============================================================

describe('Client Registration', () => {
  test('POST /v1/clients creates a new client with API key', async () => {
    const res = await apiRequest('POST', '/v1/clients', {
      name: 'Test Corp',
      contact_email: 'test@example.com',
      plan: 'pilot'
    });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toMatch(/^cli_/);
    expect(res.body.api_key).toMatch(/^sws_/);
    expect(res.body.api_key.length).toBeGreaterThan(20);
    expect(res.body.plan).toBe('pilot');
  });

  test('POST /v1/clients rejects missing name', async () => {
    const res = await apiRequest('POST', '/v1/clients', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name_required');
  });
});

// ============================================================
// Authentication
// ============================================================

describe('Authentication', () => {
  test('rejects requests without API key', async () => {
    const res = await apiRequest('POST', '/v1/sessions', { session_id: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_credentials');
  });

  test('rejects requests with wrong API key', async () => {
    const res = await apiRequest('POST', '/v1/sessions', { session_id: 'test' }, {
      'X-SWS-API-Key': 'wrong_key',
      'X-SWS-Client-ID': 'demo_client'
    });
    expect(res.status).toBe(403);
  });

  test('accepts valid demo credentials', async () => {
    const res = await apiRequest('POST', '/v1/sessions', {
      session_id: 'auth_test_' + Date.now()
    }, DEMO_HEADERS);
    expect(res.status).toBe(201);
  });
});

// ============================================================
// Session Scoring — The Core
// ============================================================

describe('Session Scoring', () => {
  test('scores a human-like session HIGH', async () => {
    const res = await apiRequest('POST', '/v1/sessions', {
      session_id: 'human_session_' + Date.now(),
      duration_ms: 300000,
      interaction_count: 45,
      hash_count: 8,
      game_id: 'test_app',
      decisions: [
        { optionCount: 2, responseTimeMs: 650 },
        { optionCount: 2, responseTimeMs: 720 },
        { optionCount: 4, responseTimeMs: 950 },
        { optionCount: 4, responseTimeMs: 1100 },
        { optionCount: 8, responseTimeMs: 1400 },
        { optionCount: 8, responseTimeMs: 1250 },
        { optionCount: 16, responseTimeMs: 1800 },
        { optionCount: 16, responseTimeMs: 2100 },
      ]
    }, DEMO_HEADERS);

    expect(res.status).toBe(201);
    expect(res.body.score.human_confidence).toBeGreaterThan(0.4);
    expect(res.body.score.verdict).not.toBe('possible_automation_detected');
    expect(res.body.signals.hicks_law).toBeGreaterThan(0.5);
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.receipt_id).toMatch(/^rcpt_/);
    expect(res.body.receipt.proof.receipt_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('scores a bot-like session LOW on Hick\'s Law', async () => {
    const res = await apiRequest('POST', '/v1/sessions', {
      session_id: 'bot_session_' + Date.now(),
      duration_ms: 5000,
      interaction_count: 10,
      hash_count: 2,
      game_id: 'test_app',
      decisions: [
        { optionCount: 2, responseTimeMs: 50 },
        { optionCount: 4, responseTimeMs: 50 },
        { optionCount: 8, responseTimeMs: 50 },
        { optionCount: 16, responseTimeMs: 50 },
        { optionCount: 2, responseTimeMs: 50 },
        { optionCount: 4, responseTimeMs: 50 },
      ]
    }, DEMO_HEADERS);

    expect(res.status).toBe(201);
    expect(res.body.signals.hicks_law).toBeLessThan(0.4);
  });

  test('receipt contains SHA-256 hash', async () => {
    const res = await apiRequest('POST', '/v1/sessions', {
      session_id: 'receipt_test_' + Date.now(),
      duration_ms: 60000,
      interaction_count: 20
    }, DEMO_HEADERS);

    expect(res.body.receipt.proof.algorithm).toBe('SHA-256');
    expect(res.body.receipt.proof.receipt_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('receipt privacy fields are correct', async () => {
    const res = await apiRequest('POST', '/v1/sessions', {
      session_id: 'privacy_test_' + Date.now(),
      duration_ms: 60000
    }, DEMO_HEADERS);

    expect(res.body.receipt.privacy.no_content_recorded).toBe(true);
    expect(res.body.receipt.privacy.no_pii_collected).toBe(true);
    expect(res.body.receipt.privacy.coppa_compliant).toBe(true);
    expect(res.body.receipt.privacy.scif_eligible).toBe(true);
  });

  test('response does NOT expose trade secret values', async () => {
    const res = await apiRequest('POST', '/v1/sessions', {
      session_id: 'secret_test_' + Date.now(),
      duration_ms: 60000,
      decisions: [
        { optionCount: 2, responseTimeMs: 500 },
        { optionCount: 4, responseTimeMs: 800 },
        { optionCount: 8, responseTimeMs: 1100 },
        { optionCount: 16, responseTimeMs: 1400 },
        { optionCount: 2, responseTimeMs: 550 },
      ]
    }, DEMO_HEADERS);

    const json = JSON.stringify(res.body);
    // Should NOT contain raw CV, correlation values, fixation counts, or weight values
    expect(json).not.toContain('raw_cv');
    expect(json).not.toContain('correlation');
    expect(json).not.toContain('fixations');
    expect(json).not.toContain('0.25'); // timing weight — should not appear
    expect(json).not.toContain('0.20'); // fitts weight
  });
});

// ============================================================
// Replay Protection
// ============================================================

describe('Replay Protection', () => {
  test('rejects duplicate session ID (anti-replay)', async () => {
    const sessionId = 'replay_test_' + Date.now();

    // First submission — should work
    const res1 = await apiRequest('POST', '/v1/sessions', {
      session_id: sessionId,
      duration_ms: 60000
    }, DEMO_HEADERS);
    expect(res1.status).toBe(201);

    // Second submission with same ID — should be rejected
    const res2 = await apiRequest('POST', '/v1/sessions', {
      session_id: sessionId,
      duration_ms: 60000
    }, DEMO_HEADERS);
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('duplicate_session');
  });
});

// ============================================================
// Receipt Verification
// ============================================================

describe('Receipt Verification', () => {
  test('verifies a valid receipt', async () => {
    // Generate a session + receipt
    const sessionRes = await apiRequest('POST', '/v1/sessions', {
      session_id: 'verify_test_' + Date.now(),
      duration_ms: 120000,
      interaction_count: 30
    }, DEMO_HEADERS);

    const receiptId = sessionRes.body.receipt.receipt_id;
    const receiptHash = sessionRes.body.receipt.proof.receipt_hash;

    // Verify it
    const verifyRes = await apiRequest('POST', '/v1/sessions/verify', {
      receipt_id: receiptId,
      receipt_hash: receiptHash
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.receipt_hash).toBe(receiptHash);
  });

  test('rejects tampered receipt hash', async () => {
    const sessionRes = await apiRequest('POST', '/v1/sessions', {
      session_id: 'tamper_test_' + Date.now(),
      duration_ms: 60000
    }, DEMO_HEADERS);

    const receiptId = sessionRes.body.receipt.receipt_id;

    const verifyRes = await apiRequest('POST', '/v1/sessions/verify', {
      receipt_id: receiptId,
      receipt_hash: 'tampered_' + '0'.repeat(55)
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(false);
    expect(verifyRes.body.reason).toBe('hash_mismatch');
  });

  test('returns 404 for unknown receipt', async () => {
    const res = await apiRequest('POST', '/v1/sessions/verify', {
      receipt_id: 'rcpt_nonexistent'
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Client Stats
// ============================================================

describe('Client Stats', () => {
  test('returns usage stats for authenticated client', async () => {
    // Submit a few sessions first
    await apiRequest('POST', '/v1/sessions', {
      session_id: 'stats_test_1_' + Date.now(),
      duration_ms: 60000
    }, DEMO_HEADERS);

    const res = await apiRequest('GET', '/v1/clients/demo_client/stats', null, DEMO_HEADERS);
    expect(res.status).toBe(200);
    expect(res.body.client_id).toBe('demo_client');
    expect(res.body.stats.total_sessions).toBeGreaterThanOrEqual(1);
    expect(res.body.stats.tier_distribution).toBeDefined();
  });

  test('rejects viewing another client\'s stats', async () => {
    const res = await apiRequest('GET', '/v1/clients/other_client/stats', null, DEMO_HEADERS);
    expect(res.status).toBe(403);
  });
});
