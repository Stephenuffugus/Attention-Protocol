#!/usr/bin/env node
'use strict';
const path = require('path');
const ADMIN_PATH = path.join(__dirname, '..', 'proof', 'functions', 'node_modules', 'firebase-admin');
const admin = require(ADMIN_PATH);
admin.initializeApp({ projectId: 'sws-attention-proofs' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('demos').orderBy('timestamp', 'desc').limit(8).get();
  if (snap.empty) { console.log('demos collection is empty.'); process.exit(0); }
  console.log('Most recent ' + snap.size + ' sessions:\n');
  snap.forEach(doc => {
    const d = doc.data();
    const ts = d.timestamp ? new Date(d.timestamp).toISOString() : '(no timestamp)';
    const ua = (d.user_agent || '').slice(0, 60);
    console.log('  ' + ts);
    console.log('    id        : ' + doc.id);
    console.log('    source    : ' + (d.source_type || '(none)'));
    console.log('    composite : ' + (d.composite != null ? d.composite.toFixed(3) : '(none)'));
    console.log('    tier      : ' + (d.quality_tier || '(none)'));
    console.log('    UA        : ' + ua);
    console.log('');
  });
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
