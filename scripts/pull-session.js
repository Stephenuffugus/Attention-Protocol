#!/usr/bin/env node
/**
 * Pull a session document from the sws-attention-proofs Firestore for
 * diagnostic work. Uses anonymous auth — the same permission scope the live
 * gallery uses to read its own writes.
 *
 * Usage:
 *   node scripts/pull-session.js <session_id>
 *   node scripts/pull-session.js latest  # most recent session by timestamp
 */
'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const {
  getFirestore, collection, doc, getDoc, getDocs, query, orderBy, limit
} = require('firebase/firestore');

// Same config the live demo uses (public by design — reads are gated by auth)
const firebaseConfig = {
  apiKey: 'AIzaSyDbpqisJpnoh2OUYSJIdKIo17SdF0eGPiM',
  authDomain: 'sws-attention-proofs.firebaseapp.com',
  projectId: 'sws-attention-proofs',
  storageBucket: 'sws-attention-proofs.firebasestorage.app',
  messagingSenderId: '420661886092',
  appId: '1:420661886092:web:placeholder'
};

(async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/pull-session.js <session_id|latest>');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  const db = getFirestore(app);

  if (arg === 'latest') {
    const q = query(collection(db, 'demos'), orderBy('timestamp', 'desc'), limit(5));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, data: d.data() }));
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const d = await getDoc(doc(db, 'demos', arg));
    if (!d.exists()) {
      console.error('No document at demos/' + arg);
      process.exit(2);
    }
    console.log(JSON.stringify({ id: d.id, data: d.data() }, null, 2));
  }
  process.exit(0);
})().catch(err => { console.error('fatal:', err.message); process.exit(3); });
