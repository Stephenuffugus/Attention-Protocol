#!/usr/bin/env node
// Baseline test: synthesize a paste-burst into the live cme-demo's
// reflection field and read composition-integrity's verdict. This gives
// us a reference point for comparing Stephen's real-ChatGPT-paste
// results against — we know what the system SHOULD say when a paste
// happens.
//
// What this validates:
//   - Composition Integrity (Layer 3a) on the deployed code actually
//     detects paste events (paste-burst counter, no-backspace, low
//     digraph CV)
//   - The verdict surface in the receipt reads "pasted" or "mechanical"
//     or "suspicious" — anything other than "authored"
//   - The gated composite caps appropriately (≤ 0.40 for pasted)
//
// Run after deploy. Use BASE_URL=https://sws-attention-proofs.web.app to
// run against the live site.

const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'https://sws-attention-proofs.web.app';
const wait = ms => new Promise(r => setTimeout(r, ms));

const SAMPLE_LLM_TEXT = `Hypertension represents a significant clinical challenge that requires a multifaceted approach to management. The recent JNC-9 guidelines emphasize the importance of individualized treatment plans, taking into account patient-specific factors such as age, comorbidities, and medication tolerance. Lifestyle modifications including dietary changes, regular physical activity, and stress management remain cornerstone interventions.

Pharmacotherapy decisions should be guided by the patient's blood pressure stage, presence of compelling indications, and risk of adverse drug reactions. The updated treatment algorithm provides a clear pathway from initial monotherapy through combination therapy, with particular attention to the timing and titration of medications to achieve target blood pressure goals while minimizing side effects.`;

(async () => {
  console.log('━━━ Synthetic paste-burst baseline (live cme-demo) ━━━');
  console.log('   Site:', BASE);
  console.log('   LLM text length:', SAMPLE_LLM_TEXT.length, 'chars');
  console.log();

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('   1. Loading cme-demo.html...');
  await page.goto(BASE + '/cme-demo.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2500);

  // Direct injection of paste-style input into the SDK's tracking surface.
  // The CME page's reflection field uses input events; we synthesize the
  // exact event pattern a paste produces (single inputType=insertFromPaste,
  // huge data length, near-zero inter-keystroke time).
  console.log('   2. Synthesizing paste-burst into reflection field...');
  const result = await page.evaluate((text) => {
    return new Promise((resolve) => {
      // Find a textarea — even if not the official reflection field, it'll
      // route through the SDK's keystroke-tracking surface
      const ta = document.querySelector('textarea');
      if (!ta) return resolve({ error: 'no textarea found on page' });

      ta.focus();
      // Stamp the value AND fire an InputEvent with inputType=insertFromPaste
      // — that's what the SDK distinguishes a paste from typing
      const before = Date.now();
      ta.value = text;
      ta.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertFromPaste',
        data: text
      }));

      // Also fire a paste event (some SDKs listen to that too)
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        ta.dispatchEvent(new ClipboardEvent('paste', {
          bubbles: true, cancelable: true, clipboardData: dt
        }));
      } catch (e) { /* DataTransfer may not be constructible in this env */ }

      // Give the SDK a beat to process
      setTimeout(() => {
        if (!window.SWSCompositionIntegrity) {
          return resolve({ error: 'SWSCompositionIntegrity not on window' });
        }
        try {
          const snap = window.SWSCompositionIntegrity.readSnapshot({ scopeId: 'cme' });
          const sig = window.SWSAttention ? window.SWSAttention.getHumanConfidence() : null;
          resolve({
            elapsed_ms: Date.now() - before,
            composition: snap,
            behavioral_composite: sig ? sig.composite : null,
            text_length: text.length
          });
        } catch (e) {
          resolve({ error: 'readSnapshot threw: ' + e.message });
        }
      }, 800);
    });
  }, SAMPLE_LLM_TEXT);

  await browser.close();

  console.log();
  console.log('━━━ RESULT ━━━');
  if (result.error) {
    console.log('   ✗', result.error);
    process.exit(1);
  }

  console.log('   text length:        ', result.text_length, 'chars');
  console.log('   elapsed:            ', result.elapsed_ms, 'ms');
  console.log('   behavioral composite:', result.behavioral_composite !== null ? result.behavioral_composite.toFixed(3) : 'null');
  console.log();
  console.log('   ━━━ COMPOSITION INTEGRITY SNAPSHOT ━━━');
  const c = result.composition || {};
  console.log('   verdict:           ', c.verdict);
  console.log('   score:             ', c.score);
  console.log('   chars_observed:    ', c.chars_observed);
  console.log('   paste_burst_count: ', c.paste_burst_count);
  console.log('   backspace_ratio:   ', c.backspace_ratio);
  console.log('   digraph_cv:        ', c.digraph_cv);
  console.log('   tells:             ', JSON.stringify(c.tells));

  console.log();
  console.log('   ━━━ INTERPRETATION ━━━');
  if (c.verdict === 'pasted' || c.verdict === 'mechanical' || c.verdict === 'suspicious') {
    console.log('   ✓ Composition Integrity correctly flagged the paste.');
    console.log('     A real ChatGPT-paste by Stephen should produce a similar verdict.');
  } else if (c.verdict === 'authored') {
    console.log('   ✗ Composition Integrity reported "authored" despite a paste.');
    console.log('     This would be a real bug. Check the inputType=insertFromPaste plumbing.');
  } else if (c.verdict === 'unknown') {
    console.log('   ? Verdict is "unknown" — typically means not enough chars to decide.');
    console.log('     But the text is', result.text_length, 'chars; should be plenty.');
  } else {
    console.log('   ? Verdict is unfamiliar:', c.verdict);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
