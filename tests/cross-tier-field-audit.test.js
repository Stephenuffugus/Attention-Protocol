/**
 * Cross-tier field audit (R8-NEW-3 + R8-NEW-4 prevention).
 *
 * Catches the class of bug where a demo HTML file fails to ship a field
 * that the Cloud Functions trigger / signReceipt endpoint reads. Both
 * 2026-05-07 findings were of this shape:
 *
 *   R8-NEW-3: trigger read session.event_log; production demo flow
 *             nested it at session.receipt_payload.event_log. Wall
 *             silently inactive on real users for weeks.
 *
 *   R8-NEW-4: trigger read session.environmental, session.composition_
 *             integrity, session.consent; cme-demo.html omitted all
 *             three. Three defenses silently inactive on cme-demo
 *             traffic.
 *
 * Both bugs would have been caught at CI by this test. Run via:
 *   npx jest tests/cross-tier-field-audit.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const FUNCTIONS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'proof', 'functions', 'index.js'), 'utf8'
);

// Fields the Cloud Functions trigger / signReceipt endpoint reads from the
// session document. Adding a new field here forces the cross-tier audit to
// require every demo HTML to ship it (or a documented fallback path).
//
// Each entry: { name, fallback (optional) }
//   name: top-level field name
//   fallback: regex matching an alternate path that satisfies the audit
const TRIGGER_READ_FIELDS = [
  { name: 'session_id' },
  { name: 'signals' },
  { name: 'duration_sec' },
  { name: 'hashes_earned' },
  { name: 'composition_integrity' },
  { name: 'environmental' },
  { name: 'consent' },
  { name: 'uid' },
  // event_log can be top-level OR nested in receipt_payload (R8-NEW-3 fallback).
  { name: 'event_log', fallback: /receipt_payload\s*:\s*receipt\s*\?\s*receipt\.payload/ }
];

const DEMO_HTMLS_TO_AUDIT = [
  'proof/demo.html',
  'proof/cme-demo.html'
];

/**
 * Extract the saveSession data-object body from a demo HTML.
 * Returns the substring of the HTML between `function saveSession(`
 * and the first `db.collection('demos').doc(...).set(...)` call.
 */
function extractSaveSessionBody(htmlContent) {
  const fnIdx = htmlContent.indexOf('function saveSession(');
  if (fnIdx < 0) return null;
  const setIdx = htmlContent.indexOf("db.collection('demos').doc", fnIdx);
  if (setIdx < 0) return null;
  return htmlContent.substring(fnIdx, setIdx);
}

describe('Cross-tier field audit (Cloud Functions trigger ↔ demo HTMLs)', () => {

  test('the trigger source still references every field listed here', () => {
    // If the trigger renames a field but this test list doesn't update,
    // we'd silently miss audit coverage. Fail loud if any tracked field
    // can no longer be found in the source.
    const missingFromSource = [];
    TRIGGER_READ_FIELDS.forEach(({ name }) => {
      // session.NAME OR session?.NAME
      const re = new RegExp('\\bsession\\??\\.' + name + '\\b');
      if (!re.test(FUNCTIONS_SRC)) missingFromSource.push(name);
    });
    expect(missingFromSource).toEqual([]);
  });

  DEMO_HTMLS_TO_AUDIT.forEach((relPath) => {
    test(`${relPath} ships every field the trigger reads`, () => {
      const html = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
      const body = extractSaveSessionBody(html);
      expect(body).not.toBeNull();
      expect(body.length).toBeGreaterThan(200); // sanity

      const missing = [];
      TRIGGER_READ_FIELDS.forEach(({ name, fallback }) => {
        // Top-level: a line like `<NAME>: <value>` inside the data object.
        // We use word-boundary + colon to avoid matching substrings.
        const topLevel = new RegExp('\\b' + name + '\\s*:').test(body);
        const fallbackOk = fallback ? fallback.test(body) : false;
        if (!topLevel && !fallbackOk) missing.push(name);
      });

      if (missing.length) {
        // Friendly failure message: which fields, which demo, why it matters
        const msg =
          relPath + ' is missing top-level fields the Cloud Functions trigger ' +
          'reads: [' + missing.join(', ') + ']. ' +
          'This is the R8-NEW-3 / R8-NEW-4 bug class: client ships the data, ' +
          'server ignores it because the path differs, defense layers are ' +
          'silently inactive on real users. Add the field at the top level of ' +
          'the saveSession data object, or add a fallback regex to ' +
          'TRIGGER_READ_FIELDS in this test if a nested path is intentional.';
        throw new Error(msg);
      }
    });
  });

  test('tracked field list size is non-trivial (sanity guard)', () => {
    // If someone deletes the field list, every test passes vacuously.
    expect(TRIGGER_READ_FIELDS.length).toBeGreaterThanOrEqual(8);
  });
});
