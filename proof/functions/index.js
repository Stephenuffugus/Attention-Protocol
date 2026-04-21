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

function buildCredential(session) {
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
// Whitelist-project + truncate to known fields. Prevents attacker
// from injecting arbitrary extra JSON fields into the signed receipt,
// and bounds each layer's size. Finding: audit Apr 21.
// ============================================================

function _truncate(s, n) {
  return typeof s === 'string' ? s.slice(0, n) : s;
}

const LAYER_LIMIT_BYTES = 8192;
const PAYLOAD_LIMIT_BYTES = 65536;

function sanitizeSession(session) {
  const bodyBytes = JSON.stringify(session).length;
  if (bodyBytes > PAYLOAD_LIMIT_BYTES) {
    const err = new Error('payload_too_large');
    err.http_status = 413;
    err.details = { limit_bytes: PAYLOAD_LIMIT_BYTES, got_bytes: bodyBytes };
    throw err;
  }
  const clean = {
    session_id:     _truncate(String(session.session_id), 128),
    composite:      session.composite,
    signals:        typeof session.signals === 'object' ? session.signals : {},
    duration_ms:    Math.max(0, Math.min(86400000, Number(session.duration_ms) || 0)),
    duration_formatted: _truncate(session.duration_formatted, 64),
    focus_score:    Math.max(0, Math.min(100, Number(session.focus_score) || 0)),
    quality_tier:   _truncate(session.quality_tier, 32),
    interaction_count: Math.max(0, Math.min(100000, Number(session.interaction_count) || 0)),
    content_id:     _truncate(session.content_id, 256),
    content_name:   _truncate(session.content_name, 256),
    uid:            _truncate(session.uid, 128),
    verdict:        _truncate(session.verdict, 64),
    environmental:         session.environmental || null,
    composition_integrity: session.composition_integrity || null,
    consent:               session.consent || null,
    honeypot:              session.honeypot || null
  };
  for (const k of ['environmental','composition_integrity','consent','honeypot','signals']) {
    if (clean[k] && JSON.stringify(clean[k]).length > LAYER_LIMIT_BYTES) {
      const err = new Error('layer_too_large');
      err.http_status = 413;
      err.details = { field: k, limit_bytes: LAYER_LIMIT_BYTES };
      throw err;
    }
  }
  return clean;
}

async function signSessionReceipt(session, keyHex, kid) {
  const cred = buildCredential(session);
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

    try {
      const { jwt, credential } = await signSessionReceipt(
        clean,
        SIGNING_KEY.value(),
        SIGNING_KID.value() || 'sws-attention-2026-04'
      );
      const credUrl = 'https://sws-attention-proofs.web.app/prove-humanness.html#c=' + jwt;
      res.status(200).json({
        signed_jwt: jwt,
        credential_url: credUrl,
        valid_until: credential.validUntil,
        kid: SIGNING_KID.value() || 'sws-attention-2026-04'
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

exports.publicKey = onRequest({ cors: true }, (req, res) => {
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

    try {
      // Same defense-in-depth we apply on the HTTP endpoint — a malicious
      // Firestore write must not be able to inject extra fields into the
      // signed JWT. Finding: audit Apr 21.
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
        uid: session.uid
      });
      const { jwt, credential } = await signSessionReceipt(
        clean, SIGNING_KEY.value(), SIGNING_KID.value() || 'sws-attention-2026-04');

      await snap.ref.update({
        signed_jwt: jwt,
        credential_valid_until: credential.validUntil,
        credential_url: 'https://sws-attention-proofs.web.app/prove-humanness.html#c=' + jwt,
        signed_at: admin.firestore.FieldValue.serverTimestamp(),
        signing_kid: SIGNING_KID.value() || 'sws-attention-2026-04'
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
