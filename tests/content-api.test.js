/**
 * API Server Tests — Content Attention & Drift Detection Endpoints
 *
 * Tests the server-side scoring for policy read verification
 * and performance degradation detection.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const app = require('../server/index');

// Simple test HTTP helper (no external deps)
function makeRequest(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const http = require('http');

    // Start server on random port
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-SWS-API-Key': 'sws_demo_key_2026',
          'X-SWS-Client-ID': 'demo_client',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', (e) => {
        server.close();
        reject(e);
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

// ============================================================
// CONTENT ATTENTION ENDPOINT TESTS
// ============================================================

describe('POST /v1/sessions/content-attention', () => {

  test('scores a thoroughly-read policy document', async () => {
    const res = await makeRequest('POST', '/v1/sessions/content-attention', {
      session_id: 'content_test_' + Date.now(),
      document_id: 'insurance_policy_v3',
      sections: {
        intro: {
          title: 'Introduction',
          wordCount: 150,
          totalDwellMs: 45000,  // 45s for 150 words = 200 WPM
          viewEntries: 1,
          reReadCount: 0,
          activeSignals: 12,
          textSelections: 0,
          maxIntersectionRatio: 0.95,
          intersectionSamples: [0.9, 0.95, 1.0],
          scrollVelocities: []
        },
        coverage: {
          title: 'Coverage Details',
          wordCount: 400,
          totalDwellMs: 120000, // 2 min for 400 words = 200 WPM
          viewEntries: 2,
          reReadCount: 1,
          activeSignals: 30,
          textSelections: 2,
          maxIntersectionRatio: 1.0,
          intersectionSamples: [0.85, 0.9, 0.95, 1.0],
          scrollVelocities: []
        },
        exclusions: {
          title: 'Exclusions',
          wordCount: 300,
          totalDwellMs: 90000,
          viewEntries: 1,
          reReadCount: 0,
          activeSignals: 20,
          textSelections: 1,
          maxIntersectionRatio: 0.9,
          intersectionSamples: [0.85, 0.9],
          scrollVelocities: []
        }
      }
    });

    expect(res.status).toBe(201);
    expect(res.body.content_attention).toBeDefined();
    expect(res.body.content_attention.documentScore).toBeGreaterThan(0.5);
    expect(res.body.content_attention.verdict).toMatch(/thoroughly_read|partially_read/);
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.receipt_id).toMatch(/^rcpt_content_/);

    console.log('\n  === API: POLICY READ VERIFICATION ===');
    console.log(`  Document score: ${res.body.content_attention.documentScore}`);
    console.log(`  Verdict:        ${res.body.content_attention.verdict}`);
    console.log(`  Sections read:  ${res.body.content_attention.sectionsRead}/${res.body.content_attention.totalSections}`);
    console.log(`  Receipt ID:     ${res.body.receipt.receipt_id}`);
    console.log('  =====================================\n');
  });

  test('scores a bot scroll-through as not_read', async () => {
    const res = await makeRequest('POST', '/v1/sessions/content-attention', {
      session_id: 'bot_content_' + Date.now(),
      sections: {
        section1: {
          title: 'Section 1',
          wordCount: 500,
          totalDwellMs: 200,  // 0.2 seconds for 500 words
          viewEntries: 1,
          reReadCount: 0,
          activeSignals: 0,
          textSelections: 0,
          maxIntersectionRatio: 0.1,
          intersectionSamples: [0.1],
          scrollVelocities: [
            { y: 0, t: 0 },
            { y: 5000, t: 200 }  // instant scroll
          ]
        },
        section2: {
          title: 'Section 2',
          wordCount: 300,
          totalDwellMs: 100,
          viewEntries: 1,
          reReadCount: 0,
          activeSignals: 0,
          textSelections: 0,
          maxIntersectionRatio: 0.1,
          intersectionSamples: [0.05],
          scrollVelocities: []
        }
      }
    });

    expect(res.status).toBe(201);
    expect(res.body.content_attention.verdict).toBe('not_read');
    expect(res.body.content_attention.documentScore).toBeLessThan(0.2);
    expect(res.body.content_attention.sectionsMissed).toBeGreaterThanOrEqual(2);
  });

  test('rejects request without sections', async () => {
    const res = await makeRequest('POST', '/v1/sessions/content-attention', {
      session_id: 'no_sections_' + Date.now()
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sections_required');
  });

  test('rejects request without session_id', async () => {
    const res = await makeRequest('POST', '/v1/sessions/content-attention', {
      sections: { a: { wordCount: 100, totalDwellMs: 5000 } }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('session_id_required');
  });

  test('rejects request without auth headers', async () => {
    const res = await makeRequest('POST', '/v1/sessions/content-attention', {
      session_id: 'no_auth_' + Date.now(),
      sections: { a: { wordCount: 100, totalDwellMs: 5000 } }
    }, {
      'X-SWS-API-Key': 'bad_key',
      'X-SWS-Client-ID': 'bad_client'
    });

    expect(res.status).toBe(403);
  });
});

// ============================================================
// DRIFT DETECTION ENDPOINT TESTS
// ============================================================

describe('POST /v1/sessions/drift-check', () => {

  const BASELINE = {
    reactionTime: { mean: 300, stddev: 50, cv: 0.167, count: 30 },
    clickPrecision: { mean: 5, stddev: 2, count: 30 },
    scrollRhythm: { mean: 500, cv: 0.3, count: 20 },
    mouseJitter: { mean: 1.2, stddev: 0.5, count: 25 },
    interactionFrequency: { meanGap: 2000, cv: 0.4, count: 20 }
  };

  test('returns normal for matching current performance', async () => {
    const res = await makeRequest('POST', '/v1/sessions/drift-check', {
      session_id: 'drift_normal_' + Date.now(),
      baseline: BASELINE,
      current: {
        reactionTimes: [290, 310, 280, 320, 300, 295, 305, 310, 285, 300],
        clickPrecisions: [4, 5, 6, 5, 4, 5, 6, 5, 4, 5],
        scrollIntervals: [480, 520, 500, 490, 510],
        mouseJitter: [1.1, 1.3, 1.2, 1.1, 1.2],
        interactionGaps: [1900, 2100, 2000, 1950, 2050]
      }
    });

    expect(res.status).toBe(200);
    expect(res.body.drift).toBeDefined();
    expect(res.body.drift.level).toBe('normal');
    expect(res.body.drift.driftScore).toBeLessThan(0.3);

    console.log('\n  === API: DRIFT CHECK — NORMAL ===');
    console.log(`  Drift score: ${res.body.drift.driftScore}`);
    console.log(`  Level:       ${res.body.drift.level}`);
    console.log('  ================================\n');
  });

  test('detects degraded performance', async () => {
    const res = await makeRequest('POST', '/v1/sessions/drift-check', {
      session_id: 'drift_degraded_' + Date.now(),
      baseline: BASELINE,
      current: {
        reactionTimes: [500, 520, 480, 550, 510, 530, 490, 560, 500, 540],
        clickPrecisions: [12, 14, 11, 13, 15, 12, 14, 11, 13, 12],
        scrollIntervals: [300, 800, 200, 900, 400],
        mouseJitter: [3.0, 2.8, 3.2, 2.9, 3.1],
        interactionGaps: [4000, 3500, 4500, 3800, 4200]
      }
    });

    expect(res.status).toBe(200);
    expect(res.body.drift.level).toMatch(/warning|alert|critical/);
    expect(res.body.drift.degradedSignals).toBeGreaterThanOrEqual(2);
    expect(res.body.drift.recommendation).toBeTruthy();

    console.log('\n  === API: DRIFT CHECK — DEGRADED ===');
    console.log(`  Drift score:      ${res.body.drift.driftScore}`);
    console.log(`  Level:            ${res.body.drift.level}`);
    console.log(`  Degraded signals: ${res.body.drift.degradedSignals}/${res.body.drift.totalSignals}`);
    console.log(`  Recommendation:   ${res.body.drift.recommendation}`);
    console.log('  ==================================\n');
  });

  test('rejects without baseline', async () => {
    const res = await makeRequest('POST', '/v1/sessions/drift-check', {
      session_id: 'no_baseline_' + Date.now(),
      current: { reactionTimes: [300, 310, 290] }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('baseline_required');
  });

  test('rejects without current data', async () => {
    const res = await makeRequest('POST', '/v1/sessions/drift-check', {
      session_id: 'no_current_' + Date.now(),
      baseline: BASELINE
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('current_required');
  });
});
