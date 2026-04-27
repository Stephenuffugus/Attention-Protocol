# Runbook: Ed25519 Signing-Key Rotation

**When to run:** signing key surfaces in any external context (paste in chat, screenshot, log file, support ticket); routine quarterly rotation; key rotation cadence required by a customer's compliance program.

**RTO target:** key rotated + new JWKS published within 30 minutes; verifier acceptance window aligned within 24 hours.

## Pre-flight

- [ ] Confirm you are the only person executing the rotation (avoid double-rotate races).
- [ ] Ensure the current `SWS_SIGNING_KEY` and `SWS_SIGNING_KID` are accessible in Google Secret Manager (`gcloud secrets versions list`).
- [ ] Verify `proof/.well-known/attention-pubkey.json` is being served fresh — the round-3 fix sets `Cache-Control: no-store` on this endpoint so cached old keys won't persist past the rotation.

## Execute

1. Generate the new keypair locally:
   ```bash
   node scripts/rotate-signing-key.js
   ```
   This writes `rotation-staging/new-private-key.txt` (gitignored) and
   `rotation-staging/new-jwks.json`.

2. Add the new private key as a new Secret Manager version:
   ```bash
   echo -n "$(cat rotation-staging/new-private-key.txt)" | \
     gcloud secrets versions add SWS_SIGNING_KEY --data-file=-
   ```
   Cloud Functions auto-pick the latest version on next cold start.

3. Update `proof/.well-known/attention-pubkey.json` to include BOTH
   the old and new JWKs (with `sws_validFrom` / `sws_validUntil`
   bounding the issuance window for each — round-2 R2-NEW-5 / R3-NEW-2
   require these). Set the new key's `sws_validFrom` to NOW; set the
   old key's `sws_validUntil` to NOW + 24h grace period.

4. Update `SWS_SIGNING_KID` Secret Manager version with the new kid.

5. Deploy:
   ```bash
   firebase deploy --only hosting,functions
   ```

6. Verify: in a fresh browser, paste a freshly-issued JWT into
   `verify.html`. Check that `kid` matches the new value and that
   `iat` falls within the new key's validity window.

## Validate

- [ ] `verify.html` shows green ✓ for a fresh receipt.
- [ ] Old receipts (issued before rotation) still verify against the
      old kid — verify the JWKS contains BOTH keys and old receipts'
      `iat` falls within the old key's `sws_validUntil + 300s` skew.
- [ ] Cloud Function logs show no `signing_failed` errors after rotation.

## Rollback

If the new key is compromised before deploy: don't add it to Secret
Manager. Delete `rotation-staging/`. No customer-visible change.

If the new key is compromised after deploy:
1. Add a NEWER key version (same procedure as above).
2. Set the compromised key's `sws_validUntil` to NOW (immediate cutoff)
   and re-deploy hosting.
3. The compromised key's already-issued receipts are now invalid (the
   verifier rejects on `iat_after_kid_validUntil`).
4. Customer-communicate: any receipt with the compromised kid issued
   after compromise time is suspect.

## Cleanup (24h post-deploy)

- [ ] Remove the OLD JWK from `attention-pubkey.json` (its
      `sws_validUntil` has passed, so receipts under that key now
      reject anyway, but cleaner to drop it).
- [ ] Securely delete `rotation-staging/new-private-key.txt`.
