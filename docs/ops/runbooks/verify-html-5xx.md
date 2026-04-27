# Runbook: verify.html Returning 5xx / Page Errors

**When to run:** synthetic monitor (R2-NEW-23 — queued) reports verify.html down; customer pastes a JWT and sees a server error; uptime drops below 99% for the verifier path.

**RTO target:** restore verify.html within 30 minutes — this is the highest-priority surface (every customer integrates against it).

## Symptoms

- 5xx status from `https://sws-attention-proofs.web.app/verify.html`
- Page loads but shows a JS exception in DevTools console
- Page loads but the verify button does nothing on click
- Customer integration ticket: "verifier broken"

## Triage

1. **Open verify.html in a fresh browser window.** What does the page do?
2. **Open DevTools console.** Look for JS errors. The most common are:
   - `crypto.subtle.verify is not a function` → browser too old (Chrome <113); user-side issue, not ours.
   - `jwks.keys.find is not a function` → JWKS endpoint returned malformed JSON; route to `jwks-outage.md`.
   - `header.kid is undefined` → the JWT being verified is malformed; user-side.
   - `iat_before_kid_validFrom` → JWKS rotation deploy issue; route to `signing-key-rotation.md`.

3. **Check Cloud Functions logs** for any related errors (signReceipt errors might propagate as bad signed JWTs).

## Restore

### If verify.html itself is broken (rare)
- Revert the most recent hosting deploy:
  ```bash
  firebase hosting:clone <previous-channel-id> --site sws-attention-proofs
  # or
  firebase hosting:rollback
  ```
- This rolls back to the previous version of `proof/verify.html`.

### If a server-side dependency is broken
- JWKS issue: route to `jwks-outage.md`.
- Cloud Function issue: route to `firestore-failover.md` if it's
  Firestore-related, or check `firebase functions:log` for the
  signReceipt errors.

### If user-side (browser too old)
- Add the WebCrypto Ed25519 polyfill (T2-7 — queued) to verify.html
  with `@noble/ed25519` ~7KB fallback.
- Communicate to the customer the supported browser matrix.

## Validate

- [ ] `curl -i .../verify.html` returns 200
- [ ] In a fresh browser, click the demo "Load seven-layer demo
      receipt" button → page renders the layers and shows ✓ Verified
- [ ] In a fresh browser, paste a fresh real receipt → page verifies
- [ ] No JS exceptions in DevTools console
- [ ] `humanVerification.trustTier` displays correctly (post-WALL)

## Communication

- If verify.html was down >5 minutes, status update.
- If a customer integration was affected, individual notification.
