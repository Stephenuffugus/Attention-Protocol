# Runbook: JWKS Endpoint Outage

**When to run:** `verify.html` shows "jwks_fetch_failed_NNN" errors; uptime monitor pages on `/.well-known/attention-pubkey.json`; customer reports verification failures.

**RTO target:** restore JWKS serving within 30 minutes (every verifier worldwide depends on this endpoint).

## Symptoms

- `verify.html` displays: "✗ Verification error" with `jwks_fetch_failed_NNN`
- Cold-storage `scripts/verify-offline.js` errors on JWK loading
- Receipt issuance still works (Cloud Functions have private key in Secret Manager) but verification breaks

## Triage

1. Test direct fetch:
   ```bash
   curl -i https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json
   ```
2. If 404 or 5xx, route to **Firebase Hosting outage** path.
3. If 200 but malformed JSON, route to **JWKS file corruption** path.
4. If 200 with empty `keys` array, route to **JWKS deploy regression** path.

## Restore

### Firebase Hosting outage path
- Check Firebase Status Console: https://status.firebase.google.com
- If global incident: nothing to do but communicate to customers; the
  rest of the proof gallery is also down.
- If only our project: `firebase hosting:rollback` to the last known
  good deploy.

### JWKS file corruption path
- Restore from git:
  ```bash
  git show HEAD:proof/.well-known/attention-pubkey.json > /tmp/jwks-restored.json
  ```
- Validate JSON: `cat /tmp/jwks-restored.json | jq . > /dev/null`
- Validate fields: each key must have `kty`, `crv`, `x`, `kid`, `use`,
  `alg`, AND `sws_validFrom` + `sws_validUntil` (R3-NEW-2 mandatory).
- Copy back: `cp /tmp/jwks-restored.json proof/.well-known/attention-pubkey.json`
- Deploy: `firebase deploy --only hosting`

### JWKS deploy regression path
- The deploy somehow shipped an empty / wrong JWKS.
- Same as corruption path: restore from a known-good git revision.

## Validate

- [ ] `curl -i .../.well-known/attention-pubkey.json` returns 200
- [ ] Response is valid JSON with non-empty `keys` array
- [ ] `Cache-Control: no-store, max-age=0, must-revalidate` header present (R3-NEW fix)
- [ ] `verify.html` with the demo button verifies green
- [ ] Synthetic monitor (when wired) returns to green within 5 minutes

## Communication

- If outage > 5 minutes, post status update.
- If customer-impacting, individual notifications.
