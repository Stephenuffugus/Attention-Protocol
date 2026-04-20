#!/usr/bin/env node
/**
 * SWS Attention Protocol — xAPI Conversion CLI
 *
 * Convert any SWS receipt JSON or signed JWT into an xAPI 1.0.3 Statement
 * that a Learning Record Store (Moodle / Canvas / Articulate / D2L /
 * Cornerstone / any ADL xAPI-compliant endpoint) can ingest directly.
 *
 * Usage:
 *   node scripts/to-xapi.js <file.json>                  # one file
 *   node scripts/to-xapi.js <file.json> --activity=IRI   # override object.id
 *   echo 'eyJhbGci...' | node scripts/to-xapi.js --jwt   # raw JWT from stdin
 *
 * Recognized input shapes:
 *   - a receipt JSON (from SWSReceipts.generateReceipt)
 *   - a signed-receipt bundle with { signed_jwt } (harness output)
 *   - a raw signed JWT string (with --jwt)
 *
 * Output is pretty-printed xAPI JSON, suitable for POST-ing to an LRS:
 *   curl -X POST https://lrs.example.com/xapi/statements \
 *        -H "Authorization: Basic ..." \
 *        -H "X-Experience-API-Version: 1.0.3" \
 *        -H "Content-Type: application/json" \
 *        -d @statement.json
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const xapi = require('../src/sdk/xapi-adapter');

function parseArgs(argv) {
  const args = { file: null, jwt: false, activityIri: null, activityType: null };
  for (const a of argv.slice(2)) {
    if (a === '--jwt') args.jwt = true;
    else if (a.startsWith('--activity=')) args.activityIri = a.slice(11);
    else if (a.startsWith('--activity-type=')) args.activityType = a.slice(16);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
      process.exit(0);
    } else if (!a.startsWith('--')) {
      args.file = a;
    }
  }
  return args;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);

  let payload;
  if (args.jwt) {
    // Raw JWT from stdin
    const jwt = (await readStdin()).trim();
    if (!jwt) { console.error('Expected JWT on stdin after --jwt'); process.exit(1); }
    const stmt = xapi.fromSignedJwt(jwt, {
      activityIri: args.activityIri || undefined,
      activityType: args.activityType || undefined
    });
    const v = xapi.validate(stmt);
    if (!v.valid) {
      console.error('Statement failed structural validation:', v.errors.join(', '));
      process.exit(2);
    }
    console.log(JSON.stringify(stmt, null, 2));
    return;
  }

  if (!args.file) {
    console.error('Usage: node scripts/to-xapi.js <file.json>');
    console.error('   or: echo "<jwt>" | node scripts/to-xapi.js --jwt');
    process.exit(1);
  }

  try {
    payload = JSON.parse(fs.readFileSync(path.resolve(args.file), 'utf8'));
  } catch (e) {
    console.error('Could not read/parse:', args.file, '-', e.message);
    process.exit(1);
  }

  let stmt;
  if (payload && typeof payload.signed_jwt === 'string') {
    stmt = xapi.fromSignedJwt(payload.signed_jwt, {
      activityIri: args.activityIri || undefined,
      activityType: args.activityType || undefined
    });
  } else if (payload && payload.receipt_id) {
    stmt = xapi.fromReceipt(payload, {
      activityIri: args.activityIri || undefined,
      activityType: args.activityType || undefined
    });
  } else if (payload && payload.naive && payload.naive.jwt) {
    // run-bot-vs-human.js output shape: multi-profile bundle
    console.error('Multi-profile bundle detected. Converting each profile to a separate statement.');
    const out = {};
    for (const key of Object.keys(payload)) {
      const row = payload[key];
      if (row && typeof row === 'object' && row.jwt) {
        try {
          out[key] = xapi.fromSignedJwt(row.jwt);
        } catch (e) {
          out[key] = { error: e.message };
        }
      }
    }
    console.log(JSON.stringify(out, null, 2));
    return;
  } else {
    console.error('Unrecognized input. Expected: receipt JSON, {signed_jwt:...} bundle, or multi-profile bundle.');
    process.exit(1);
  }

  const v = xapi.validate(stmt);
  if (!v.valid) {
    console.error('Statement failed structural validation:', v.errors.join(', '));
    process.exit(2);
  }

  console.log(JSON.stringify(stmt, null, 2));
}

main().catch(e => {
  console.error('ERROR:', e && e.message);
  process.exit(1);
});
