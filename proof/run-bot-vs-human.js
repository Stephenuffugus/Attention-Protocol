/**
 * SWS Attention Protocol — Live Bot vs Human Proof
 *
 * Runs one or more Puppeteer bot profiles against the live demo.html,
 * completes all 5 phases, and lets the SDK score them end-to-end.
 * Each session writes a real receipt to Firestore (demos collection)
 * with is_bot=true so we can filter them against real human sessions.
 *
 * Usage:
 *   node proof/run-bot-vs-human.js              # run all profiles once
 *   node proof/run-bot-vs-human.js naive        # run only naive bot
 *   node proof/run-bot-vs-human.js --local      # run against localhost:4000 instead of live
 *
 * Prereqs (local mode only): `npm run proof:gallery` in another terminal.
 */

require('dotenv').config(); // Load SWS_SIGNING_KEY / SWS_SIGNING_KID from .env
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const signer = require('../src/sdk/attention-signer');
const anchor = require('../src/sdk/attention-anchor');
const VC = require('../src/sdk/verifiable-credentials');

const args = process.argv.slice(2);
const useLocal = args.includes('--local');
const profileFilter = args.find(a => !a.startsWith('--'));
const BASE_URL = useLocal
  ? 'http://localhost:4000'
  : 'https://sws-attention-proofs.web.app';

// ============================================================
// BOT PROFILES
// ============================================================

const profiles = {
  naive: {
    name: 'Naive Bot',
    description: 'Constant 50-100ms clicks, no variance, straight-line cursor',
    readDelayMs: 200,
    questionDelayMs: () => 80,
    targetDelayMs: () => 60,
    typeDelayMs: () => 15,
    typedText: 'a a a a a a a a a a a a a a a a a a a a a a a a a',
    mouseVariance: 0
  },
  jittered: {
    name: 'Jittered Bot',
    description: 'Random 100-300ms delays, uncorrelated with task complexity',
    readDelayMs: 500,
    questionDelayMs: () => 100 + Math.random() * 200,
    targetDelayMs: () => 100 + Math.random() * 200,
    typeDelayMs: () => 50 + Math.random() * 50,
    typedText: 'the quick brown fox jumps over the lazy dog the quick brown fox jumps over',
    mouseVariance: 2
  },
  sophisticated: {
    name: 'Sophisticated Bot',
    description: 'Attempts human-like variation, scripted pseudo-reading',
    readDelayMs: 3000,
    questionDelayMs: (optCount) => 400 + optCount * 150 + Math.random() * 400,
    targetDelayMs: () => 350 + Math.random() * 350,
    typeDelayMs: () => 80 + Math.random() * 120,
    typedText: 'attention verification receipts prove human engagement without collecting content data just behavioral shape',
    mouseVariance: 10
  },
  llm_paster: {
    name: 'LLM Paster',
    description: 'Realistic interactions + PASTES the typed answer (mimics ChatGPT copy-paste)',
    readDelayMs: 3000,
    questionDelayMs: (optCount) => 400 + optCount * 150 + Math.random() * 400,
    targetDelayMs: () => 350 + Math.random() * 350,
    typeDelayMs: () => 80 + Math.random() * 120,
    typedText: 'The attention protocol enforces behavioral verification through timing entropy fitts law and hicks law compliance while preserving user privacy through cryptographic attestation rather than keystroke logging or screen recording. Multi-layer attestation combines environmental fingerprinting behavioral shape and composition integrity for regulatory-grade proof of human engagement. This receipt is verifiable offline.',
    mouseVariance: 10,
    pasteInsteadOfType: true
  }
};

// ============================================================
// RUNNER
// ============================================================

async function runProfile(browser, profile) {
  console.log(`\n━━━ ${profile.name} ━━━`);
  console.log(`   ${profile.description}`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Forward page console to our terminal (muted — too noisy)
  // page.on('console', msg => console.log('  [page]', msg.text()));

  await page.goto(`${BASE_URL}/demo.html?source=harness_test`, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000); // let Firebase auth settle

  // ---- PHASE 1: READ ----
  // Scroll the reading area slowly, then click "Done Reading"
  await page.evaluate(async (ms) => {
    const area = document.querySelector('.reading-area');
    if (!area) return;
    const step = area.scrollHeight / 20;
    for (let i = 0; i < 20; i++) {
      area.scrollTop = step * i;
      await new Promise(r => setTimeout(r, ms / 20));
    }
  }, profile.readDelayMs * 10);
  await clickByText(page, 'Done Reading');
  await wait(500);

  // ---- PHASE 2: DECIDE (9 questions) ----
  for (let q = 0; q < 9; q++) {
    // Wait for options to render
    await page.waitForSelector('.decision-opt', { timeout: 5000 }).catch(() => {});
    const optCount = await page.evaluate(() => document.querySelectorAll('.decision-opt').length);
    if (optCount === 0) break;

    await wait(profile.questionDelayMs(optCount));

    // Bot picks first option every time (no comprehension)
    await page.evaluate(() => {
      const opts = document.querySelectorAll('.decision-opt');
      if (opts[0]) opts[0].click();
    });
    await wait(300);
  }

  // ---- PHASE 3: TARGETS (12 clicks) ----
  for (let t = 0; t < 12; t++) {
    await page.waitForSelector('.target.lit', { timeout: 5000 }).catch(() => {});
    await wait(profile.targetDelayMs());
    const hit = await page.evaluate(() => {
      const lit = document.querySelector('.target.lit');
      if (lit) { lit.click(); return true; }
      return false;
    });
    if (!hit) break;
    await wait(200);
  }

  // ---- PHASE 4: TYPE (or PASTE, for LLM paster profile) ----
  await page.waitForSelector('.typing-area', { timeout: 5000 }).catch(() => {});
  await page.click('.typing-area').catch(() => {});
  if (profile.pasteInsteadOfType) {
    // Simulate a paste: set value in one shot + dispatch input w/ insertFromPaste
    await page.evaluate((text) => {
      const el = document.querySelector('.typing-area');
      if (!el) return;
      el.focus();
      el.value = text;
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
    }, profile.typedText);
  } else {
    await page.type('.typing-area', profile.typedText, { delay: profile.typeDelayMs() });
  }
  await wait(500);
  await clickByText(page, 'Need 20');  // button says "Need 20+ words →" or "Submit →" after threshold
  await wait(300);
  // Fallback: try the generic complete button
  await page.evaluate(() => {
    if (typeof completePhase === 'function') completePhase(4);
  });

  // ---- PHASE 5: RESULTS (wait for report + save to Firestore) ----
  await wait(3000);

  // Give the environmental gate a moment to resolve (4s timeout internally)
  await wait(1500);

  // Extract scores, receipt, environmental + composition-integrity snapshot
  const result = await page.evaluate(() => {
    if (typeof SWSAttention === 'undefined') return null;
    const stats = SWSAttention.getStats();
    const confidence = stats.humanConfidence || SWSAttention.getHumanConfidence();
    const receiptEl = document.getElementById('r-hash');
    const ci = (typeof SWSCompositionIntegrity !== 'undefined')
      ? SWSCompositionIntegrity.readSnapshot({ scopeId: 'demo' })
      : null;
    return {
      composite: confidence.composite,
      signals: confidence,
      totalHashes: stats.totalHashes,
      lastHash: stats.lastHash,
      receiptDisplay: receiptEl ? receiptEl.textContent : null,
      environmental: window.__swsEnvironmental || null,
      composition_integrity: ci
    };
  });

  await page.close();

  if (!result) {
    console.log('   ⚠ SDK not accessible — profile failed');
    return null;
  }

  const envSummary = !result.environmental
    ? 'not loaded'
    : !result.environmental.loaded
      ? 'unknown (' + result.environmental.error + ')'
      : (result.environmental.bot ? 'BOT (' + result.environmental.bot_kind + ')' : 'clean');

  const ciSummary = !result.composition_integrity
    ? 'not loaded'
    : result.composition_integrity.composition_verdict +
      (result.composition_integrity.composition_integrity_score !== null
        ? ' (score ' + result.composition_integrity.composition_integrity_score.toFixed(2) + ')'
        : '');

  console.log(`   composite:     ${result.composite.toFixed(3)}`);
  console.log(`   env gate:      ${envSummary}`);
  console.log(`   signal 21 CI:  ${ciSummary}`);
  console.log(`   hashes:        ${result.totalHashes}`);
  console.log(`   lastHash:      ${result.lastHash ? result.lastHash.slice(0, 16) + '...' : 'null'}`);
  return result;
}

// Click a button whose visible text contains the given substring
async function clickByText(page, text) {
  const clicked = await page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const match = btns.find(b => b.textContent.toLowerCase().includes(t.toLowerCase()));
    if (match && !match.disabled) { match.click(); return true; }
    return false;
  }, text);
  return clicked;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================
// MAIN
// ============================================================

// ============================================================
// SIGNED RECEIPT EMISSION
// ============================================================

function buildReceiptFromResult(profileKey, result) {
  const now = new Date();
  const sigObj = result.signals || {};
  return {
    receipt_id: 'rcpt_bot_' + profileKey + '_' + now.getTime(),
    receipt_version: '1.0',
    protocol: 'SWS Proof of Attention Protocol',
    issuer: 'SWS Strategic Media LLC',
    generated_at: now.toISOString(),
    generated_timestamp: now.getTime(),
    subject_id: 'bot_' + profileKey,
    application_id: 'bot-vs-human-harness',
    content_id: 'demo_session',
    content_name: 'SWS Live Demo',
    engagement: {
      duration_ms: null,
      duration_formatted: null,
      focus_score: Math.round(result.composite * 100),
      quality_tier: result.composite < 0.4 ? 'bot_suspected'
                  : result.composite < 0.55 ? 'shallow'
                  : result.composite < 0.7 ? 'active'
                  : 'deep',
      interaction_count: null
    },
    human_verification: {
      composite_score: result.composite,
      verdict: result.composite >= 0.55 ? 'verified_human' : 'bot_suspected',
      timing_entropy: sigObj.timingEntropy,
      fitts_compliance: sigObj.fittsCompliance,
      hicks_compliance: sigObj.hicksCompliance,
      scroll_saccade: sigObj.scrollSaccade,
      micro_pause: sigObj.microPause,
      touch_variance: sigObj.touchVariance
    },
    environmental: result.environmental || null,
    composition_integrity: result.composition_integrity || null,
    proof: {
      hash_count: result.totalHashes,
      hash_ids: result.lastHash ? [result.lastHash] : [],
      algorithm: 'SHA-256',
      receipt_hash: result.lastHash
    },
    privacy: {
      no_content_recorded: true,
      no_pii_collected: true,
      no_urls_tracked: true,
      coppa_compliant: true
    }
  };
}

async function signReceipts(results, activeSigner, opts) {
  opts = opts || {};
  const anchorToBitcoin = opts.anchorToBitcoin !== false;
  const signed = {};
  for (const [key, result] of Object.entries(results)) {
    if (!result) { signed[key] = null; continue; }
    const receipt = buildReceiptFromResult(key, result);
    const cred = VC.fromReceipt(receipt);
    const jwt = await VC.toSignedJwt(cred, activeSigner);

    // Self-verify roundtrip as a sanity check
    const verification = await signer.verifyJwt(jwt, activeSigner.publicKeyHex);

    // Bitcoin anchor the JWT itself (what a buyer actually distributes).
    // Fail-to-unknown — harness keeps running even if OTS calendars are down.
    let ots = null;
    if (anchorToBitcoin) {
      try {
        const jwtHash = crypto.createHash('sha256').update(jwt, 'utf8').digest('hex');
        ots = await anchor.stamp(jwtHash);
      } catch (e) {
        ots = { status: 'failed', error: 'harness_exception: ' + (e && e.message) };
      }
    }

    signed[key] = {
      profile: key,
      receipt_id: receipt.receipt_id,
      receipt_hash: receipt.proof.receipt_hash,
      composite_score: receipt.human_verification.composite_score,
      verdict: receipt.human_verification.verdict,
      jwt: jwt,
      jwt_sha256: crypto.createHash('sha256').update(jwt, 'utf8').digest('hex'),
      verified: verification.valid,
      kid: activeSigner.kid,
      ots: ots
    };
  }
  return signed;
}

function persistSignedReceipts(signed) {
  const outDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `signed-jwts-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(signed, null, 2) + '\n', 'utf8');
  return outPath;
}

// ============================================================
// MAIN
// ============================================================

(async () => {
  console.log(`SWS Bot vs Human — running against ${BASE_URL}`);
  console.log(`Profiles: ${profileFilter || 'all'}\n`);

  // Load signer from env; graceful degrade if SWS_SIGNING_KEY unset.
  const activeSigner = await signer.loadSignerFromEnv();
  if (activeSigner) {
    console.log(`Signer loaded: kid=${activeSigner.kid} alg=${activeSigner.algorithm}`);
  } else {
    console.log('Signer: NOT LOADED (set SWS_SIGNING_KEY in .env to sign receipts)');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const results = {};
  const toRun = profileFilter ? [profileFilter] : Object.keys(profiles);

  for (const key of toRun) {
    if (!profiles[key]) { console.log(`Unknown profile: ${key}`); continue; }
    try {
      results[key] = await runProfile(browser, profiles[key]);
    } catch (err) {
      console.log(`   ✗ Error: ${err.message}`);
      results[key] = null;
    }
  }

  await browser.close();

  // Summary
  console.log('\n━━━ SUMMARY ━━━');
  Object.entries(results).forEach(([k, r]) => {
    if (r) {
      console.log(`${profiles[k].name.padEnd(20)} composite=${r.composite.toFixed(3)} hashes=${r.totalHashes}`);
    } else {
      console.log(`${profiles[k].name.padEnd(20)} FAILED`);
    }
  });

  const composites = Object.values(results).filter(r => r).map(r => r.composite);
  if (composites.length > 1) {
    const max = Math.max(...composites);
    const min = Math.min(...composites);
    console.log(`\nBot composite range: ${min.toFixed(3)} - ${max.toFixed(3)}`);
    console.log(`For comparison, a real human session (Stephen, 2026-04-20) scored 0.573`);
    console.log(`Separation vs weakest bot (behavioral only): ${(0.573 - min).toFixed(3)}`);

    // Environmental gate: how many of these bots were caught by BotD regardless of behavioral?
    const envCaught = Object.values(results).filter(r =>
      r && r.environmental && r.environmental.loaded && r.environmental.bot
    );
    const envLoaded = Object.values(results).filter(r =>
      r && r.environmental && r.environmental.loaded
    );
    console.log(`\nEnv gate (BotD): ${envCaught.length} / ${envLoaded.length} bots caught by environmental fingerprint alone`);
    envCaught.forEach(r => {
      const k = Object.entries(results).find(([_, v]) => v === r)[0];
      console.log(`  ${profiles[k].name.padEnd(20)} → ${r.environmental.bot_kind}`);
    });

    // Signal 21 (Composition Integrity): flagged pastes / mechanical typing
    const ciFlagged = Object.entries(results).filter(([_, r]) =>
      r && r.composition_integrity && ['pasted', 'mechanical', 'suspicious'].includes(r.composition_integrity.composition_verdict)
    );
    const ciLoaded = Object.values(results).filter(r =>
      r && r.composition_integrity && r.composition_integrity.composition_verdict !== 'unknown'
    );
    console.log(`\nSignal 21 (Composition Integrity): ${ciFlagged.length} / ${ciLoaded.length} profiles flagged by typing/paste fingerprint`);
    ciFlagged.forEach(([k, r]) => {
      console.log(`  ${profiles[k].name.padEnd(20)} → ${r.composition_integrity.composition_verdict} (score ${r.composition_integrity.composition_integrity_score !== null ? r.composition_integrity.composition_integrity_score.toFixed(2) : 'n/a'})`);
    });

    // Receipt-wide gated composite: behavioral + env + composition + honeypot → min-cap
    const receiptComposite = require('../src/sdk/receipt-composite');
    console.log('\n━━━ RECEIPT-WIDE COMPOSITE (GATED) ━━━');
    console.log('Behavioral composite alone → single number. Gated composite → min-cap against independent layers.');
    let gatedMin = 1.0;
    let gatedMax = 0.0;
    Object.entries(results).forEach(([k, r]) => {
      if (!r) return;
      const gated = receiptComposite.computeFinalComposite({
        behavioralComposite: r.composite,
        environmental: r.environmental
          ? { loaded: r.environmental.loaded, bot: r.environmental.bot, botKind: r.environmental.bot_kind }
          : null,
        compositionIntegrity: r.composition_integrity
          ? { verdict: r.composition_integrity.composition_verdict }
          : null,
        honeypot: null // harness doesn't exercise honeypot; LLM-in-the-loop simulator is separate
      });
      const gateLabels = gated.gatesApplied.map(g => g.layer + ':' + g.reason.split(':')[0]).join(', ') || 'none';
      console.log(`  ${profiles[k].name.padEnd(20)} behavioral=${r.composite.toFixed(3)}  final=${gated.finalComposite.toFixed(3)}  tier=${gated.tierFinal}  [gates: ${gateLabels}]`);
      if (gated.finalComposite < gatedMin) gatedMin = gated.finalComposite;
      if (gated.finalComposite > gatedMax) gatedMax = gated.finalComposite;
    });
    const humanBaseline = 0.573; // Stephen 2026-04-20 reference session
    console.log(`\nGated composite — bot range: ${gatedMin.toFixed(3)} – ${gatedMax.toFixed(3)}`);
    console.log(`Gap to human baseline (${humanBaseline.toFixed(3)}): ${(humanBaseline - gatedMax).toFixed(3)} (strongest bot) / ${(humanBaseline - gatedMin).toFixed(3)} (weakest bot)`);
    console.log(`Behavioral-only gap (pre-gate): ${(humanBaseline - Math.max(...composites)).toFixed(3)} strongest / ${(humanBaseline - Math.min(...composites)).toFixed(3)} weakest`);
  }

  // Signed-receipt block (only if a signer was available)
  if (activeSigner) {
    try {
      const signed = await signReceipts(results, activeSigner);
      const outPath = persistSignedReceipts(signed);

      console.log('\n━━━ SIGNED RECEIPTS (EdDSA) ━━━');
      Object.values(signed).forEach(s => {
        if (!s) return;
        const jwtPreview = s.jwt.slice(0, 48) + '…' + s.jwt.slice(-12);
        const status = s.verified ? '✓ verified' : '✗ NOT VERIFIED';
        console.log(`${s.profile.padEnd(16)} ${status}  ${jwtPreview}`);
      });

      // OpenTimestamps status per signed receipt
      const anyOts = Object.values(signed).some(s => s && s.ots);
      if (anyOts) {
        console.log('\n━━━ BITCOIN ANCHORING (OpenTimestamps) ━━━');
        Object.values(signed).forEach(s => {
          if (!s || !s.ots) return;
          const label = s.ots.status === 'bitcoin_confirmed'
            ? `✓ Bitcoin block #${s.ots.bitcoin_block_height}`
            : s.ots.status === 'pending'
              ? 'pending (upgrade in ~1–12 hrs)'
              : `✗ ${s.ots.error || s.ots.status}`;
          console.log(`${s.profile.padEnd(16)} ${label}`);
        });
        console.log('\nRun `node scripts/upgrade-timestamps.js` later to pull Bitcoin attestations.');
      }
      console.log(`\nSaved: ${path.relative(process.cwd(), outPath)}`);
      console.log(`Public key: proof/.well-known/attention-pubkey.json (kid=${activeSigner.kid})`);
    } catch (err) {
      console.log(`\n✗ Signing failed: ${err.message}`);
    }
  }
})().catch(err => { console.error(err); process.exit(1); });
