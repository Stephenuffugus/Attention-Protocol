/**
 * SWS Attention Protocol — Proof Catalog Firebase Config
 *
 * SEPARATE Firebase project for proof/demo data.
 * This keeps all test results, comparisons, and demo sessions
 * completely isolated from live website/game user data.
 *
 * Live site:  focus-grove-fffa8 (stevieweedseed.com visitors + game)
 * Proof data: sws-attention-proofs (test results, demos, sales collateral)
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Click "Add project" → name it "sws-attention-proofs"
 * 3. Enable Firestore Database (start in test mode for now)
 * 4. Enable Anonymous Authentication
 * 5. Go to Project Settings → Your apps → Add web app
 * 6. Copy the config values below
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

var SWS_PROOF_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDbpqisJpnoh2OUYSJIdKIo17SdF0eGPiM",
  authDomain: "sws-attention-proofs.firebaseapp.com",
  databaseURL: "https://sws-attention-proofs-default-rtdb.firebaseio.com",
  projectId: "sws-attention-proofs",
  storageBucket: "sws-attention-proofs.firebasestorage.app",
  messagingSenderId: "420661886092",
  appId: "1:420661886092:web:a4c79cd07fc804428f4fa9"
};

/**
 * Firestore Collection Structure:
 *
 * sws-attention-proofs/
 * ├── runs/                              ← each proof execution
 * │   └── {run_id}/
 * │       ├── metadata (timestamp, git SHA, total pass/fail)
 * │       └── verticals/
 * │           ├── bot-detection
 * │           ├── content-reading
 * │           ├── video-attention
 * │           ├── fatigue-detection
 * │           ├── session-integrity
 * │           ├── vertical-profiles
 * │           ├── ga4-comparison
 * │           ├── temporal-analysis
 * │           └── e2e-pipeline
 * │
 * ├── latest/                            ← always points to most recent run
 * │   └── {vertical_name} (snapshot of latest results)
 * │
 * └── demos/                             ← live demo sessions with prospects
 *     └── {company_name}/
 *         └── {session_id}
 *
 * Firestore Rules (deploy to sws-attention-proofs):
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // Proof runs: authenticated users can read, only admin can write
 *     match /runs/{document=**} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null;
 *     }
 *     match /latest/{document=**} {
 *       allow read: if true;  // Public read for gallery
 *       allow write: if request.auth != null;
 *     }
 *     match /demos/{document=**} {
 *       allow read, write: if request.auth != null;
 *     }
 *   }
 * }
 */

// For Node.js (proof runner)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SWS_PROOF_FIREBASE_CONFIG;
}
