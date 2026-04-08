#!/usr/bin/env node
/**
 * SWS Attention Protocol — Proof Catalog Uploader
 *
 * Uploads proof results to the dedicated sws-attention-proofs Firebase project.
 * Reads from proof/results/latest.json and writes to Firestore.
 *
 * Usage:
 *   node proof/upload-to-firestore.js               → uploads latest results
 *   node proof/upload-to-firestore.js --dry-run      → shows what would be uploaded
 *
 * PREREQUISITE: You must first:
 *   1. Create the sws-attention-proofs Firebase project
 *   2. Fill in the real credentials in proof/firebase-config.js
 *   3. npm install firebase (if not already installed)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');

const RESULTS_PATH = path.resolve(__dirname, 'results/latest.json');
const CONFIG_PATH = path.resolve(__dirname, 'firebase-config.js');

// Check prerequisites
if (!fs.existsSync(RESULTS_PATH)) {
  console.error('No proof results found. Run first: node proof/run-proofs.js');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log('');
console.log('='.repeat(60));
console.log('  SWS Proof Catalog — Firestore Uploader');
console.log('='.repeat(60));
console.log('');
console.log(`  Run ID:      ${results.run_id}`);
console.log(`  Generated:   ${results.generated}`);
console.log(`  Verticals:   ${results.summary.verticals_passed}/${results.summary.verticals_total} passed`);
console.log('');

if (dryRun) {
  console.log('  [DRY RUN] Would upload the following to Firestore:');
  console.log('');
  console.log('  Collection: runs/' + results.run_id);
  console.log('    - metadata: timestamp, git SHA, pass/fail summary');
  Object.keys(results.verticals).forEach(v => {
    console.log(`    - verticals/${v}: ${results.verticals[v].verdict || 'no verdict'}`);
  });
  console.log('');
  console.log('  Collection: latest/');
  Object.keys(results.verticals).forEach(v => {
    console.log(`    - ${v}: snapshot of latest results`);
  });
  console.log('');
  console.log('  To actually upload, run without --dry-run');
  console.log('  (Requires firebase credentials in proof/firebase-config.js)');
  process.exit(0);
}

// Attempt real upload
try {
  const firebaseConfig = require(CONFIG_PATH);

  if (firebaseConfig.apiKey === 'YOUR_PROOF_FIREBASE_API_KEY') {
    console.log('  Firebase credentials not yet configured.');
    console.log('  To set up:');
    console.log('    1. Create "sws-attention-proofs" project at console.firebase.google.com');
    console.log('    2. Enable Firestore and Anonymous Auth');
    console.log('    3. Add web app and copy config to proof/firebase-config.js');
    console.log('');
    console.log('  Results are saved locally at:');
    console.log(`    ${RESULTS_PATH}`);
    console.log('');
    console.log('  You can still view them in the gallery:');
    console.log('    npx http-server proof -p 4000 -c-1');
    console.log('    Open http://localhost:4000/gallery.html');
    process.exit(0);
  }

  // Dynamic import of firebase
  let firebase;
  try {
    firebase = require('firebase/app');
    require('firebase/auth');
    require('firebase/firestore');
  } catch (e) {
    console.log('  Firebase SDK not installed. Run: npm install firebase');
    console.log('  Results are saved locally and viewable in the gallery.');
    process.exit(0);
  }

  const app = firebase.initializeApp(firebaseConfig, 'proof-uploader');
  const db = firebase.firestore(app);

  // Sign in anonymously
  firebase.auth(app).signInAnonymously().then(() => {
    console.log('  Authenticated. Uploading...');

    const batch = db.batch();

    // Write run metadata
    const runRef = db.collection('runs').doc(results.run_id);
    batch.set(runRef, {
      run_id: results.run_id,
      protocol: results.protocol,
      entity: results.entity,
      patent: results.patent,
      generated: results.generated,
      duration_ms: results.duration_ms,
      summary: results.summary,
      uploaded_at: Date.now()
    });

    // Write each vertical as a subcollection doc
    Object.entries(results.verticals).forEach(([key, data]) => {
      const vertRef = runRef.collection('verticals').doc(key);
      batch.set(vertRef, data);

      // Also update latest/
      const latestRef = db.collection('latest').doc(key);
      batch.set(latestRef, {
        ...data,
        run_id: results.run_id,
        generated: results.generated
      });
    });

    return batch.commit();
  }).then(() => {
    console.log('  Upload complete!');
    console.log(`  View at: https://console.firebase.google.com/project/sws-attention-proofs/firestore`);
    process.exit(0);
  }).catch(err => {
    console.error('  Upload failed:', err.message);
    process.exit(1);
  });

} catch (err) {
  console.log('  Could not load Firebase config:', err.message);
  console.log('  Results saved locally. Use the gallery to view them.');
  process.exit(0);
}
