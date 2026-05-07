/**
 * SWS Attention Protocol — Firebase Functions (in-session signing)
 *
 * Two HTTPS endpoints + optional Firestore trigger:
 *
 *   POST /signReceipt
 *     body: { session_id, composite, signals, hashes, environmental, ... }
 *     → { signed_jwt, credential_url, valid_until }
 *
 *   GET  /publicKey
 *     → redirect to /.well-known/attention-pubkey.json (convenience)
 *
 * Trigger: onSessionWritten (Firestore `demos/{sessionId}` create)
 *   → writes a signed_receipt field back to the doc so the client
 *     can read it without a round-trip.
 *
 * Secret management:
 *   The Ed25519 private key must be stored as a Firebase Function
 *   secret (NOT env var in code). To set:
 *     firebase functions:secrets:set SWS_SIGNING_KEY
 *     # paste the same hex private key that's in your local .env
 *
 *   Optional secondary:
 *     firebase functions:secrets:set SWS_SIGNING_KID
 *     # defaults to 'sws-attention-2026-04'
 *
 * Deploy:
 *   Requires Firebase Blaze (pay-as-you-go) plan. Steps:
 *     1. Enable Blaze in the Firebase Console for project
 *        'sws-attention-proofs'.
 *     2. cd proof/functions && npm install
 *     3. firebase functions:secrets:set SWS_SIGNING_KEY
 *     4. firebase deploy --only functions
 *
 * Cost ceiling at demo scale (2M invocations/month free tier):
 *   $0 if you stay under 2M signings/month. Well above typical pilot volume.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

// Deploy marker: 2026-05-07 — force redeploy to rebind SWS_SIGNING_KEY secret
// after diagnosing 100% bad_signing_key failures across 17 production sessions
// since 2026-04-27. Source unchanged; only the marker invalidates Firebase's
// source-hash-based deploy skip.
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const SIGNING_KEY = defineSecret('SWS_SIGNING_KEY');
const SIGNING_KID = defineSecret('SWS_SIGNING_KID'); // optional

// ============================================================
// Ed25519 signer — minimal inline, avoids bundling the full SDK
// ============================================================

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function b64url(bytes) {
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signPayload(payload, keyHex, kid) {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('bad_signing_key');
  const header = { alg: 'EdDSA', typ: 'JWT', kid: kid || 'sws-attention-2026-04' };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = headerB64 + '.' + payloadB64;

  const privBytes = Buffer.from(keyHex, 'hex');
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, privBytes]);
  const privateKeyObj = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  const sig = crypto.sign(null, Buffer.from(signingInput, 'utf8'), privateKeyObj);
  return signingInput + '.' + b64url(sig);
}

// ============================================================
// Payload → Verifiable Credential (minimal inline)
// ============================================================

function buildCredential(session, walledOutcome) {
  // walledOutcome (optional): { trust_tier, server_recompute, bounds_violations }
  // Set by onSessionWritten when the wall has run; absent on the legacy
  // HTTP endpoint path. When present, the values are embedded in the
  // signed credentialSubject so OFFLINE verifiers (verify.html paste-a-
  // JWT, prove-humanness.html, scripts/verify-offline.js) can render
  // the trust tier + recompute divergence without needing the Firestore
  // doc. Without this, the wall's signal lives only in Firestore and
  // an offline verifier sees a green ✓ even on a divergent receipt.
  const now = new Date();
  const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
  const subjectDid = 'did:sws:user:' + (session.uid_hash ||
    crypto.createHash('sha256').update(session.uid || 'anon').digest('hex').slice(0, 10));

  const engagement = {
    contentId: session.content_id || 'demo_session',
    contentName: session.content_name || 'SWS Live Demo',
    durationMs: session.duration_ms || 0,
    durationFormatted: session.duration_formatted || null,
    focusScore: session.focus_score || null,
    qualityTier: session.quality_tier || 'active',
    interactionCount: session.interaction_count || 0
  };

  const hv = {
    verdict: session.verdict || 'verified_human_active_engagement',
    compositeScore: session.composite || null,
    signals: session.signals || {}
  };
  // Wall outcome plumbed into humanVerification (alongside the other
  // round-2/3 attestation flags like compositeScoreFinal + gatesApplied).
  // Verifiers consume:
  //   - hv.trustTier ∈ { 'server_attested', 'client_attested_bounds_clean',
  //                      'client_attested_no_event_log',
  //                      'client_attested_bounds_violated' }
  //   - hv.serverRecompute = { server_composite, divergence, divergent,
  //                            threshold, version } | { ok:false, reason }
  //   - hv.boundsViolations = string[]
  if (walledOutcome) {
    if (walledOutcome.trust_tier) hv.trustTier = walledOutcome.trust_tier;
    if (walledOutcome.server_recompute) hv.serverRecompute = walledOutcome.server_recompute;
    if (walledOutcome.bounds_violations && walledOutcome.bounds_violations.length > 0) {
      hv.boundsViolations = walledOutcome.bounds_violations;
    }
    // R2-NEW-2b trace-novelty fingerprint match. Embedded in the signed
    // payload so a verifier (online or offline) can reject when the
    // session's fingerprint matches a recent session from a different
    // uid — the canonical signal of a recorded-trace replay attack.
    if (walledOutcome.trace_novelty) hv.traceNovelty = walledOutcome.trace_novelty;
  }

  const receiptHash = crypto.createHash('sha256')
    .update(JSON.stringify({
      session_id: session.session_id, engagement, hv,
      at: now.toISOString()
    }))
    .digest('hex');

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://sws-attention-proofs.web.app/schemas/attention/v1'
    ],
    id: 'urn:sws:receipt:' + session.session_id,
    type: ['VerifiableCredential', 'AttentionVerificationCredential'],
    issuer: {
      id: 'did:web:sws-attention-proofs.web.app',
      name: 'SWS Strategic Media LLC',
      patent: 'SWS-PROV-001'
    },
    issuanceDate: now.toISOString(),
    validFrom: now.toISOString(),
    validUntil: validUntil.toISOString(),
    credentialSubject: {
      id: subjectDid,
      type: 'AttentionSession',
      engagement: engagement,
      humanVerification: hv,
      environmental: session.environmental || null,
      compositionIntegrity: session.composition_integrity || null,
      consentAttestation: session.consent ? {
        granted: session.consent.granted,
        categories: session.consent.categories,
        grantedAt: session.consent.timestamp,
        version: session.consent.version
      } : null
    },
    proof: {
      type: 'Sha256ReceiptIntegrity2026',
      created: now.toISOString(),
      verificationMethod: 'did:web:sws-attention-proofs.web.app#receipt-signing-key',
      proofPurpose: 'assertionMethod',
      receiptHash: receiptHash
    }
  };
}

// ============================================================
// Input sanitizer — shared by HTTP endpoint and Firestore trigger.
// Extracted to proof/functions/sanitize.js so it is testable in
// isolation (without loading firebase-functions). Finding: audit Apr 21.
// ============================================================
const { sanitizeSession } = require('./sanitize');

async function signSessionReceipt(session, keyHex, kid, walledOutcome) {
  const cred = buildCredential(session, walledOutcome);
  const payload = {
    iss: cred.issuer.id,
    sub: cred.credentialSubject.id,
    iat: Math.floor(new Date(cred.issuanceDate).getTime() / 1000),
    exp: Math.floor(new Date(cred.validUntil).getTime() / 1000),
    vc: cred
  };
  const jwt = await signPayload(payload, keyHex, kid);
  return { jwt, credential: cred };
}

// ============================================================
// HTTP ENDPOINT — signReceipt
// ============================================================

exports.signReceipt = onRequest(
  { secrets: [SIGNING_KEY, SIGNING_KID], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const session = req.body;
    if (!session || !session.session_id) {
      res.status(400).json({ error: 'missing_session_id' });
      return;
    }

    // Sanity bounds on the composite score to avoid garbage in / garbage out
    if (typeof session.composite !== 'number' ||
        session.composite < 0 || session.composite > 1) {
      res.status(400).json({ error: 'invalid_composite' });
      return;
    }

    let clean;
    try {
      clean = sanitizeSession(session);
    } catch (e) {
      if (e && e.http_status) {
        res.status(e.http_status).json(Object.assign({ error: e.message }, e.details || {}));
        return;
      }
      res.status(400).json({ error: 'invalid_session' });
      return;
    }

    // Round-6 R6-NEW-1+5 fix: shared runWall helper. Replaces the
    // duplicated HTTP-path implementation that had drifted from the
    // Firestore-trigger path (different field names, parallel
    // if-else trustTier trees, off-by-one bounds). One source of
    // truth in server-scorer.runWall. Trace-novelty is now wired in
    // via the admin context — HTTP path no longer skips it.
    const scorer = require('./server-scorer');
    let walled;
    try {
      const sessionMeta = scorer.extractSessionMetrics(clean);
      walled = await scorer.runWall(sessionMeta, { admin: admin });
    } catch (e) {
      console.error('HTTP wall error:', e && e.message ? e.message : 'unknown');
      walled = {
        trustTier: 'client_attested_bounds_violated',
        boundsViolations: ['runwall_error'],
        serverRecomputeResult: { ok: false, reason: 'runwall_threw' },
        traceNovelty: { checked: false, reason: 'runwall_threw' },
        walledOutcome: {
          trust_tier: 'client_attested_bounds_violated',
          bounds_violations: ['runwall_error'],
          server_recompute: { ok: false, reason: 'runwall_threw' },
          trace_novelty: { checked: false, reason: 'runwall_threw' }
        }
      };
    }

    try {
      const { jwt, credential } = await signSessionReceipt(
        clean,
        SIGNING_KEY.value(),
        SIGNING_KID.value() || 'sws-attention-2026-04',
        walled.walledOutcome
      );
      const credUrl = 'https://sws-attention-proofs.web.app/prove-humanness.html#c=' + jwt;
      // Round-7 R7-NEW-3: response body uses walled.walledOutcome.trace_novelty
      // (the public subset — fingerprint stripped at runWall level). The
      // raw fingerprint stays admin-only in the session_fingerprints
      // Firestore collection; never reaches the HTTP response or the
      // signed JWT. Closes the bucket-probe attack.
      res.status(200).json({
        signed_jwt: jwt,
        credential_url: credUrl,
        valid_until: credential.validUntil,
        kid: SIGNING_KID.value() || 'sws-attention-2026-04',
        trust_tier: walled.trustTier,
        server_recompute: walled.walledOutcome.server_recompute,
        bounds_violations: walled.boundsViolations,
        trace_novelty: walled.walledOutcome.trace_novelty
      });
    } catch (e) {
      // NEVER leak key material into logs
      const msg = (e && e.message) ? e.message.replace(/[0-9a-f]{32,}/g, '<REDACTED>') : 'unknown';
      res.status(500).json({ error: 'signing_failed: ' + msg });
    }
  }
);

// ============================================================
// HTTP ENDPOINT — publicKey (convenience redirect)
// ============================================================

exports.publicKey = onRequest({ cors: true }, (_req, res) => {
  res.redirect(302, 'https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json');
});

// ============================================================
// FIRESTORE TRIGGER — auto-sign new demo sessions
// ============================================================

exports.onSessionWritten = onDocumentCreated(
  { document: 'demos/{sessionId}', secrets: [SIGNING_KEY, SIGNING_KID] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const session = snap.data();
    session.session_id = event.params.sessionId;

    // Only sign sessions where a composite was captured and signing isn't done.
    if (typeof session.signals?.composite !== 'number') return;
    if (session.signed_jwt) return; // already signed

    // Round-6 R6-NEW-1+5: shared runWall helper replaces the previously-
    // duplicated plausibility-bounds + recompute + trace-novelty +
    // trustTier resolution. Now the HTTP signReceipt endpoint and this
    // Firestore-trigger path use ONE source of truth — eliminates the
    // field-name drift (duration_ms vs duration_sec etc.) and the
    // parallel if-else trustTier trees that round-6 caught as drift bait.
    const scorer = require('./server-scorer');
    let walled;
    try {
      // The Firestore-trigger doc has signals.composite at signals.composite,
      // not session.composite, plus uses hashes_earned not interaction_count.
      // Wrap in the canonical shape extractSessionMetrics expects.
      const sessionForExtract = {
        session_id: session.session_id,
        composite: session.signals.composite,
        duration_sec: session.duration_sec,
        hashes_earned: session.hashes_earned,
        composition_integrity: session.composition_integrity,
        environmental: session.environmental,
        event_log: session.event_log,
        uid: session.uid
      };
      const sessionMeta = scorer.extractSessionMetrics(sessionForExtract);
      walled = await scorer.runWall(sessionMeta, { admin: admin });
    } catch (e) {
      console.error('Trigger wall error:', e && e.message ? e.message : 'unknown');
      walled = {
        trustTier: 'client_attested_bounds_violated',
        boundsViolations: ['runwall_error'],
        serverRecomputeResult: { ok: false, reason: 'runwall_threw' },
        traceNovelty: { checked: false, reason: 'runwall_threw' },
        walledOutcome: {
          trust_tier: 'client_attested_bounds_violated',
          bounds_violations: ['runwall_error'],
          server_recompute: { ok: false, reason: 'runwall_threw' },
          trace_novelty: { checked: false, reason: 'runwall_threw' }
        }
      };
    }

    try {
      const clean = sanitizeSession({
        session_id: session.session_id,
        composite: session.signals.composite,
        signals: session.signals,
        duration_ms: session.duration_sec ? session.duration_sec * 1000 : 0,
        focus_score: session.signals.composite ? Math.round(session.signals.composite * 100) : 0,
        quality_tier: session.quality_tier,
        interaction_count: session.hashes_earned || 0,
        environmental: session.environmental,
        composition_integrity: session.composition_integrity,
        consent: session.consent,
        uid: session.uid,
        event_log: session.event_log
      });
      const { jwt, credential } = await signSessionReceipt(
        clean, SIGNING_KEY.value(), SIGNING_KID.value() || 'sws-attention-2026-04',
        walled.walledOutcome);

      await snap.ref.update({
        signed_jwt: jwt,
        credential_valid_until: credential.validUntil,
        credential_url: 'https://sws-attention-proofs.web.app/prove-humanness.html#c=' + jwt,
        signed_at: admin.firestore.FieldValue.serverTimestamp(),
        signing_kid: SIGNING_KID.value() || 'sws-attention-2026-04',
        trust_tier: walled.trustTier,
        bounds_violations: walled.boundsViolations,
        server_recompute: walled.walledOutcome.server_recompute,
        // Round-7 R7-NEW-3: persist the FULL trace_novelty (with raw
        // fingerprint) to the demos doc for forensic audit. Firestore
        // rules deny non-admin reads on demos/* (round-2 R2-1 fix), so
        // this is admin-only. The signed JWT carries only the public
        // subset (walled.walledOutcome.trace_novelty) so a verifier
        // who decodes the JWT does NOT recover the bucket value.
        trace_novelty: walled.traceNovelty
      });
    } catch (e) {
      // Log the error without key material
      console.error('Signing failed for session', event.params.sessionId, ':',
        (e && e.message) ? e.message.replace(/[0-9a-f]{32,}/g, '<REDACTED>') : 'unknown');
      await snap.ref.update({
        signing_error: 'signing_failed',
        signed_at: admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    }
  }
);
