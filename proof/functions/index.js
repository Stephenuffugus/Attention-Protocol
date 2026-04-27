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

    // Round-5 R5-NEW-1 CRITICAL fix: the HTTP endpoint must run THE
    // WALL too. Round-5 hostile review caught that this endpoint was
    // signing receipts without ever calling signSessionReceipt's
    // walledOutcome arg — so receipts issued via HTTP carried no
    // trust_tier, no serverRecompute, no boundsViolations, and an
    // attacker who POSTed {composite:0.95} got a fully-signed JWT that
    // verifiers rendered as ✓ verified with no banner. Now: same wall
    // logic as onSessionWritten (plausibility bounds + server scorer +
    // trace-novelty if a fingerprint collection is reachable).
    let serverRecomputeResult = { ok: false, reason: 'event_log_absent' };
    let traceNovelty = { checked: false };
    const boundsViolations = [];
    const composite = session.composite;
    const durationSec = session.duration_ms ? session.duration_ms / 1000 : 0;
    const ciVerdict = session.composition_integrity && session.composition_integrity.verdict;
    const envClean = session.environmental && session.environmental.loaded === true && session.environmental.bot !== true;
    const ciAuthored = ciVerdict === 'authored';
    const interactions = session.interaction_count || 0;
    if (composite > 0.85) {
      if (!envClean) boundsViolations.push('high_composite_without_clean_env');
      if (!ciAuthored) boundsViolations.push('high_composite_without_authored_ci');
      if (durationSec < 60) boundsViolations.push('high_composite_short_session_' + durationSec + 's');
      if (interactions < 5) boundsViolations.push('high_composite_low_interaction_' + interactions);
    } else if (composite > 0.50) {
      if (durationSec < 30) boundsViolations.push('mid_composite_short_session_' + durationSec + 's');
    }
    try {
      const scorer = require('./server-scorer');
      if (session.event_log) {
        serverRecomputeResult = scorer.serverRecompute(
          session.event_log, composite, durationSec, ciVerdict);
        if (!serverRecomputeResult.ok) {
          boundsViolations.push('server_recompute_failed:' + serverRecomputeResult.reason);
        } else if (serverRecomputeResult.divergent) {
          boundsViolations.push('server_recompute_divergent:client=' +
            serverRecomputeResult.client_composite + ',server=' +
            serverRecomputeResult.server_composite);
        }
        // Trace-novelty: skip on HTTP path (no Firestore admin context
        // here unless we wire it in — keep MVP scope tight). Fingerprint
        // is still computed and embedded; future iteration can wire the
        // collection query.
        const fingerprint = scorer.featureFingerprint(session.event_log, durationSec);
        if (fingerprint) {
          traceNovelty = {
            checked: false,
            reason: 'http_endpoint_no_collection_query',
            fingerprint: fingerprint
          };
        }
      } else {
        boundsViolations.push('event_log_absent');
      }
    } catch (e) {
      console.error('HTTP wall recompute error:', e && e.message ? e.message : 'unknown');
      boundsViolations.push('server_recompute_error');
    }
    let trustTier;
    if (serverRecomputeResult.ok && !serverRecomputeResult.divergent && boundsViolations.length === 0) {
      trustTier = 'server_attested';
    } else if (boundsViolations.length === 0) {
      trustTier = 'client_attested_bounds_clean';
    } else if (boundsViolations.length === 1 && boundsViolations[0] === 'event_log_absent') {
      trustTier = 'client_attested_no_event_log';
    } else {
      trustTier = 'client_attested_bounds_violated';
    }

    try {
      const walledOutcomeForJwt = {
        trust_tier: trustTier,
        bounds_violations: boundsViolations,
        server_recompute: serverRecomputeResult.ok ? {
          server_composite: serverRecomputeResult.server_composite,
          divergence: serverRecomputeResult.divergence,
          divergent: serverRecomputeResult.divergent,
          threshold: serverRecomputeResult.threshold,
          version: serverRecomputeResult.version
        } : { ok: false, reason: serverRecomputeResult.reason },
        trace_novelty: traceNovelty
      };
      const { jwt, credential } = await signSessionReceipt(
        clean,
        SIGNING_KEY.value(),
        SIGNING_KID.value() || 'sws-attention-2026-04',
        walledOutcomeForJwt
      );
      const credUrl = 'https://sws-attention-proofs.web.app/prove-humanness.html#c=' + jwt;
      res.status(200).json({
        signed_jwt: jwt,
        credential_url: credUrl,
        valid_until: credential.validUntil,
        kid: SIGNING_KID.value() || 'sws-attention-2026-04',
        trust_tier: trustTier,
        server_recompute: walledOutcomeForJwt.server_recompute,
        bounds_violations: boundsViolations
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

    // Round-4 R4-NEW-1: per-session minimum-duration + plausibility
    // bounds. Cheap 1-2h defense; catches lazy "post composite=0.95
    // with duration=2s" bypasses.
    const composite = session.signals.composite;
    const durationSec = session.duration_sec || 0;
    const envLoaded = session.environmental && session.environmental.loaded === true;
    const envClean = envLoaded && session.environmental.bot !== true;
    const ciVerdict = session.composition_integrity && session.composition_integrity.verdict;
    const ciAuthored = ciVerdict === 'authored';
    const interactions = session.hashes_earned || 0;
    const boundsViolations = [];
    if (composite > 0.85) {
      if (!envClean) boundsViolations.push('high_composite_without_clean_env');
      if (!ciAuthored) boundsViolations.push('high_composite_without_authored_ci');
      if (durationSec < 60) boundsViolations.push('high_composite_short_session_' + durationSec + 's');
      if (interactions < 5) boundsViolations.push('high_composite_low_interaction_' + interactions);
    } else if (composite > 0.50) {
      if (durationSec < 30) boundsViolations.push('mid_composite_short_session_' + durationSec + 's');
    }

    // R2-NEW-2 / "THE WALL" — server-side recompute from raw event log.
    // The canonical defense the bot-builder agent has named through
    // 4 hostile rounds. Without it, an attacker forges signals.composite
    // directly to Firestore and the trigger signs it. With it, the
    // server recomputes a subset of high-weight signals from the raw
    // events and rejects receipts where client-claimed composite
    // diverges from server-recomputed by more than DIVERGENCE_THRESHOLD
    // (currently 0.20). Forces the attacker to ALSO ship a coherent
    // event log — round-4 estimate said this raises bypass cost from
    // $50/mo + 56h to $5-20k/mo + 200-400h.
    let serverRecomputeResult = { ok: false, reason: 'event_log_absent' };
    let traceNovelty = { checked: false };
    try {
      const scorer = require('./server-scorer');
      if (session.event_log) {
        serverRecomputeResult = scorer.serverRecompute(
          session.event_log,
          composite,
          durationSec,
          ciVerdict
        );
        if (!serverRecomputeResult.ok) {
          boundsViolations.push('server_recompute_failed:' + serverRecomputeResult.reason);
        } else if (serverRecomputeResult.divergent) {
          boundsViolations.push('server_recompute_divergent:client=' +
            serverRecomputeResult.client_composite + ',server=' +
            serverRecomputeResult.server_composite);
        }

        // R2-NEW-2b / TRACE-NOVELTY MVP: feature-fingerprint the event
        // log, query Firestore for matching fingerprints from DIFFERENT
        // uids in the last 1 hour. If found, this session is suspiciously
        // close to a recently-seen one — likely a replay attack. Catches
        // the "record N human traces, replay with jitter" bypass that
        // round-4 bot-builder agent named as the next-stage attack.
        const fingerprint = scorer.featureFingerprint(session.event_log, durationSec);
        if (fingerprint) {
          try {
            const oneHourAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
            const matchSnap = await admin.firestore()
              .collection('session_fingerprints')
              .where('fingerprint', '==', fingerprint)
              .where('signed_at', '>=', oneHourAgo)
              .limit(10)
              .get();
            const matches = matchSnap.docs.filter(function(d) {
              return d.data().uid !== session.uid;
            });
            traceNovelty = {
              checked: true,
              fingerprint: fingerprint,
              recent_matches_other_uid: matches.length,
              suspicious: matches.length >= 1
            };
            if (matches.length >= 1) {
              boundsViolations.push('trace_novelty_low:' + matches.length +
                '_other_uid_in_last_hour');
            }
            // Always store the new session's fingerprint for future
            // novelty checks. TTL via a separate cleanup function or
            // Firestore TTL policy on `signed_at`.
            await admin.firestore()
              .collection('session_fingerprints')
              .add({
                fingerprint: fingerprint,
                uid: session.uid,
                session_id: session.session_id,
                signed_at: admin.firestore.FieldValue.serverTimestamp()
              });
          } catch (tnErr) {
            // Trace-novelty is best-effort; failure here doesn't block
            // signing. Fingerprint generation is local; the failure
            // path is the Firestore query/write.
            console.error('Trace-novelty error:', tnErr && tnErr.message ? tnErr.message : 'unknown');
            traceNovelty = { checked: false, reason: 'firestore_error' };
          }
        }
      } else {
        boundsViolations.push('event_log_absent');
      }
    } catch (e) {
      // Fail-safe: if the scorer module errors, don't block signing —
      // log + tag. We'd rather sign with a warning than refuse to sign
      // a legitimate session because of an unrelated server bug.
      console.error('Server-recompute error:', e && e.message ? e.message : 'unknown');
      boundsViolations.push('server_recompute_error');
    }

    // Trust-tier upgrade: server_attested is the highest tier and
    // requires (a) bounds clean, (b) server recompute ok, (c) no
    // divergence. client_attested_bounds_clean is the round-4 mid-tier
    // (no log, plausibility OK). client_attested_bounds_violated is the
    // forensic-only floor.
    let trustTier;
    if (serverRecomputeResult.ok && !serverRecomputeResult.divergent && boundsViolations.length === 0) {
      trustTier = 'server_attested';
    } else if (boundsViolations.length === 0) {
      trustTier = 'client_attested_bounds_clean';
    } else if (boundsViolations.length === 1 && boundsViolations[0] === 'event_log_absent') {
      // Legacy path (SDK didn't ship a log) — keep mid-tier so existing
      // sessions don't all flip to violated. Once SDK uniformly ships
      // logs, tighten this to a violation.
      trustTier = 'client_attested_no_event_log';
    } else {
      trustTier = 'client_attested_bounds_violated';
    }

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
      // Embed wall outcome in the signed credential so offline verifiers
      // (verify.html, prove-humanness.html, verify-offline.js) see the
      // trust_tier + recompute divergence without needing the Firestore
      // doc. THIS is what makes THE WALL user-visible end-to-end.
      const walledOutcomeForJwt = {
        trust_tier: trustTier,
        bounds_violations: boundsViolations,
        server_recompute: serverRecomputeResult.ok ? {
          server_composite: serverRecomputeResult.server_composite,
          divergence: serverRecomputeResult.divergence,
          divergent: serverRecomputeResult.divergent,
          threshold: serverRecomputeResult.threshold,
          version: serverRecomputeResult.version
        } : { ok: false, reason: serverRecomputeResult.reason },
        trace_novelty: traceNovelty.checked ? {
          fingerprint: traceNovelty.fingerprint,
          recent_matches_other_uid: traceNovelty.recent_matches_other_uid,
          suspicious: traceNovelty.suspicious
        } : { checked: false }
      };
      const { jwt, credential } = await signSessionReceipt(
        clean, SIGNING_KEY.value(), SIGNING_KID.value() || 'sws-attention-2026-04',
        walledOutcomeForJwt);

      await snap.ref.update({
        signed_jwt: jwt,
        credential_valid_until: credential.validUntil,
        credential_url: 'https://sws-attention-proofs.web.app/prove-humanness.html#c=' + jwt,
        signed_at: admin.firestore.FieldValue.serverTimestamp(),
        signing_kid: SIGNING_KID.value() || 'sws-attention-2026-04',
        trust_tier: trustTier,
        bounds_violations: boundsViolations,
        // Persist the server recompute result so a downstream verifier
        // (verify.html, prove-humanness.html, scripts/verify-offline.js)
        // can render it. Strip the per-event signal_details to keep doc
        // size bounded — the user-visible UI only needs the verdict.
        server_recompute: serverRecomputeResult.ok ? {
          server_composite: serverRecomputeResult.server_composite,
          divergence: serverRecomputeResult.divergence,
          divergent: serverRecomputeResult.divergent,
          threshold: serverRecomputeResult.threshold,
          version: serverRecomputeResult.version
        } : { ok: false, reason: serverRecomputeResult.reason }
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
