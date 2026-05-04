#!/usr/bin/env node
'use strict';
const path = require('path');
const ADMIN_PATH = path.join(__dirname, '..', 'proof', 'functions', 'node_modules', 'firebase-admin');
const admin = require(ADMIN_PATH);
admin.initializeApp({ projectId: 'sws-attention-proofs' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('demos').where('source_type', '==', 'test_stephen-phone').get();
  if (snap.empty) { console.log('Not found.'); process.exit(1); }
  snap.forEach(doc => {
    const d = doc.data();
    console.log('Doc ID:', doc.id);
    console.log('All top-level fields:', Object.keys(d).sort().join(', '));
    console.log('');
    console.log('Key values:');
    console.log('  quality_tier      :', d.quality_tier);
    console.log('  composite         :', d.composite);
    console.log('  duration_ms       :', d.duration_ms);
    console.log('  duration_sec      :', d.duration_sec);
    console.log('  interaction_count :', d.interaction_count);
    console.log('  active_signals    :', d.active_signals);
    console.log('  source_type       :', d.source_type);
    console.log('  user_agent        :', d.user_agent);
    console.log('');
    if (d.signals) {
      console.log('signals.* keys:', Object.keys(d.signals).sort().join(', '));
      console.log('signals.composite:', d.signals.composite);
      console.log('signals.activeSignals:', d.signals.activeSignals);
    }
    console.log('');
    if (d.environmental) {
      console.log('environmental.bot:', d.environmental.bot);
      console.log('environmental.loaded:', d.environmental.loaded);
    }
    if (d.composition_integrity) {
      console.log('composition_verdict:', d.composition_integrity.composition_verdict);
    }
    if (d.receipt_hash) {
      console.log('receipt_hash:', d.receipt_hash);
    }
  });
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
