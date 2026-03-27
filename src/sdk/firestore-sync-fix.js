/**
 * SWS ATTENTION PROTOCOL — FIRESTORE SYNC FIX
 * Drop-in fix for stevieweedseed.com
 *
 * WHAT THIS DOES:
 *   1. Signs in every visitor anonymously (invisible, no UI change)
 *   2. Syncs all existing unsynced hashes from localStorage to Firestore
 *   3. Keeps future hashes synced in real-time
 *
 * PREREQUISITES:
 *   - Firebase Anonymous Authentication MUST be enabled in the Firebase Console
 *     Go to: console.firebase.google.com > focus-grove-fffa8 > Authentication > Sign-in method > Anonymous > Enable
 *
 *   - Firestore Security Rules MUST allow vault writes (see firestore.rules file)
 *
 * HOW TO DEPLOY:
 *   Add this script AFTER the Firebase SDK scripts and AFTER your existing attention hash code:
 *   <script src="firestore-sync-fix.js"></script>
 *
 *   Or paste the contents directly into your existing JS file, after Firebase is initialized.
 */
(function() {
  'use strict';

  var HASHES_KEY = 'sws_attention_hashes';
  var BALANCE_KEY = 'sws_hash_balance';

  // Safety check — need Firebase
  if (typeof firebase === 'undefined') {
    console.warn('[Attention Sync] Firebase SDK not found. Load Firebase first.');
    return;
  }

  // Step 1: Anonymous Authentication
  firebase.auth().signInAnonymously().catch(function(error) {
    console.warn('[Attention Sync] Anonymous auth failed:', error.code, error.message);
  });

  // Step 2: On auth state change, sync everything
  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) return;

    console.log('[Attention Sync] Authenticated as:', user.uid, user.isAnonymous ? '(anonymous)' : '');

    // Sync unsynced hashes
    syncUnsyncedHashes(user.uid);

    // Patch the existing storeAttentionHash function to auto-sync new hashes
    patchStoreFunction(user.uid);
  });

  function syncUnsyncedHashes(uid) {
    var hashes = [];
    try {
      hashes = JSON.parse(localStorage.getItem(HASHES_KEY) || '[]');
    } catch (e) { return; }

    var unsynced = hashes.filter(function(h) { return !h.synced; });
    if (unsynced.length === 0) {
      console.log('[Attention Sync] All hashes already synced.');
      return;
    }

    console.log('[Attention Sync] Syncing ' + unsynced.length + ' hashes to Firestore...');

    var syncedCount = 0;
    var db = firebase.firestore();

    unsynced.forEach(function(record) {
      db.collection('vaults').doc(uid)
        .collection('hashes').add({
          hash: record.hash,
          event_type: record.event_type,
          timestamp: record.timestamp,
          game_id: record.game_id || 'steveweetsie_web',
          quality_tier: record.quality_tier,
          duration_ms: record.duration_ms || 0,
          interaction_count: record.interaction_count || 0,
          synced: true
        })
        .then(function() {
          record.synced = true;
          syncedCount++;
          localStorage.setItem(HASHES_KEY, JSON.stringify(hashes));

          if (syncedCount === unsynced.length) {
            console.log('[Attention Sync] All ' + syncedCount + ' hashes synced successfully!');
            updateBalanceDoc(uid, hashes);
          }
        })
        .catch(function(err) {
          console.warn('[Attention Sync] Failed to sync hash:', err.message);
        });
    });
  }

  function updateBalanceDoc(uid, hashes) {
    var totalEarned = hashes.length;
    var spentCount = hashes.filter(function(h) { return h.spent; }).length;

    firebase.firestore().collection('vaults').doc(uid)
      .collection('balance').doc('current')
      .set({
        total_earned: totalEarned,
        total_spent: spentCount,
        current: totalEarned - spentCount,
        last_updated: Date.now(),
        game_id: 'steveweetsie_web'
      }, { merge: true })
      .then(function() {
        console.log('[Attention Sync] Balance document updated. Total earned:', totalEarned);
      });
  }

  function patchStoreFunction(uid) {
    // If the existing code has a _queueCloudSync function, patch it
    if (typeof window._queueCloudSync === 'function') {
      var original = window._queueCloudSync;
      window._queueCloudSync = function(record) {
        // Try original first
        original(record);
        // Then force sync with our known-good UID
        if (uid && uid !== 'anonymous') {
          firebase.firestore().collection('vaults').doc(uid)
            .collection('hashes').add({
              hash: record.hash,
              event_type: record.event_type,
              timestamp: record.timestamp,
              game_id: record.game_id || 'steveweetsie_web',
              quality_tier: record.quality_tier,
              duration_ms: record.duration_ms || 0,
              interaction_count: record.interaction_count || 0,
              synced: true
            })
            .then(function() {
              record.synced = true;
              try {
                var hashes = JSON.parse(localStorage.getItem(HASHES_KEY) || '[]');
                var match = hashes.find(function(h) { return h.hash === record.hash; });
                if (match) match.synced = true;
                localStorage.setItem(HASHES_KEY, JSON.stringify(hashes));
              } catch(e) { /* non-critical */ }
            });
        }
      };
      console.log('[Attention Sync] Patched _queueCloudSync for real-time sync.');
    }
  }

})();
