# Product Validation Playbook
## For Stephen · Pre-pitch confidence run-through
## Time budget: ~20 minutes end-to-end

**Purpose:** This is not a unit-test run. This is a hands-on, end-to-end confirmation that the product *actually works* — code you can watch run, receipts you can hold in your hand, signatures a buyer could verify on their own machine. Run this before any pitch call. If any step fails, stop and figure out why. Do not pitch on a broken product.

Every step below has three parts:
- **Do:** what to execute
- **Expect:** what success looks like
- **Fail mode:** how to know it's broken and what to do next

---

## Phase 0 — Preflight (3 minutes)

### Step 0.1 — Clean checkout
**Do:**
```bash
cd /workspaces/Attention-Protocol
git status
git log --oneline origin/main..HEAD
```
**Expect:**
- "working tree clean" (or only MEMORY.md / .claude changes you intend)
- Empty `git log` (no unpushed commits) — if unpushed, push them before a pitch so the public repo matches what you're showing

**Fail mode:** Uncommitted changes or unpushed commits mean the live site and the code you're pitching are out of sync. Pitch only from synchronized state.

### Step 0.2 — Test suite green
**Do:**
```bash
npm test 2>&1 | tail -5
```
**Expect:**
- `Test Suites: 34 passed, 34 total` (one flaky `demo-e2e` Puppeteer test is acceptable if it passes when rerun in isolation)
- `Tests: 708 passed, 708 total`
- Runtime ~4.5 min

**Fail mode:** Any real failure — stop. You are not shipping. Fix or roll back.

### Step 0.3 — Reference artifacts present
**Do:**
```bash
ls proof/results/stephen-0573-anchored.json \
   proof/results/humanness-sample.json \
   proof/results/verify-sample-6layer.json \
   dist/evidence-kit.zip
```
**Expect:** All four exist. The first three are "canned" sample receipts for demos; the fourth is the 25 KB buyer-qualification kit.

**Fail mode:** If evidence-kit.zip is missing, run `node scripts/generate-evidence-kit.js`.

---

## Phase 1 — The live public site (4 minutes)

This is what a buyer sees when you hand them a URL.

### Step 1.1 — Proof gallery loads
**Do:** Open `https://sws-attention-proofs.web.app/` in an incognito window.

**Expect:**
- Homepage renders with the 4-persona buyer split
- No console errors (F12 → Console)
- Every top nav link resolves

**Fail mode:** Any 404, JS error, or broken layout. If this fails, nothing else matters — the buyer never gets past the front door.

### Step 1.2 — Verify page works against a known-good JWT
**Do:**
1. Open `https://sws-attention-proofs.web.app/verify.html`
2. Copy the full `signed_jwt` field from `proof/results/stephen-0573-anchored.json`
3. Paste it into the textarea on verify.html
4. Click **Verify**

**Expect:**
- Green "✓ Signature verified" banner at the top
- Issuer: "SWS Strategic Media LLC" and Key ID: `sws-attention-2026-04`
- The six-layer grid renders: Environmental / Behavioral (composite 0.573, tier "active") / Composition integrity / Consent / Ed25519 / Bitcoin anchor
- Bitcoin anchor status: `pending` or `bitcoin_confirmed` depending on when you run this

**Fail mode:** "Signature did NOT verify" on a known-good JWT means the JWKS endpoint or the signing key rotated. Check `/.well-known/attention-pubkey.json` is reachable and matches the `kid` in the JWT header.

**This is the single most important demo step.** If a buyer can watch their own browser verify a receipt we gave them, the "cryptographic receipt" pitch is now a fact, not a claim.

### Step 1.3 — Proof-of-Humanness page renders a credential
**Do:**
1. Open `https://sws-attention-proofs.web.app/prove-humanness.html`
2. From `proof/results/humanness-sample.json`, copy the `signed_jwt` (or use a compressed URL if present)
3. Paste into the verify box; click **Verify**

**Expect:**
- Green "✓ Verified human" verdict with quality tier + time-to-expiry
- Six property chips (Is human, Quality tier, Valid until, Issuer, Public key ID, No identity shown)
- A "What you did NOT learn from this credential" privacy block (PII, exact scores, session content, linkability — all listed as *not* disclosed)
- QR code block renders if `qrcode-generator` is loaded

**Fail mode:** No QR → non-blocking (graceful fallback). No verdict → signature verification broke; same fix as 1.2.

---

## Phase 2 — End-to-end from a fresh session (6 minutes)

This is where you feel the product as a user, not just a verifier.

### Step 2.1 — Run a real session through demo.html
**Do:**
1. Incognito window → `https://sws-attention-proofs.web.app/demo.html`
2. Complete all 5 phases: read the policy, answer the decisions, tap the targets, do the typed response, finish
3. **Type a natural short answer** in the typed-response phase (≥20 chars, with backspaces and normal cadence)
4. On the results screen, copy the SHA-256 receipt hash and the signed JWT (if shown)

**Expect:**
- Session takes 2–4 minutes
- Results screen shows: composite score, quality tier, Ed25519 signature status, Bitcoin/TSA anchor status, consent attestation, composition integrity verdict ("authored" for a genuine typed answer)
- The receipt hash is displayed and copyable

**Fail mode:** If the scores are wildly off (e.g., a clearly engaged human rated "background") or the receipt hash doesn't generate, something in the behavioral pipeline regressed. Inspect `demos/{sessionId}` in Firestore console.

### Step 2.2 — Take the receipt you just minted and verify it
**Do:** Paste the JWT from 2.1 into `verify.html` (another tab). Click Verify.

**Expect:**
- "✓ Signature verified" — you just watched your own session survive a round-trip through our full pipeline: signed → serialized → re-read → cryptographically validated in the browser.
- The composite layer shows your actual composite score from 2.1.
- The composition-integrity layer shows "authored" (since you typed naturally).

**Fail mode:** Same cryptographic failure modes as 1.2. If it works in 1.2 but fails here, the signing pipeline on live-demo.html is broken.

### Step 2.3 — Verify offline with `openssl` or `node` (to prove the signature is not our magic)
**Do:**
```bash
# Fetch the public key JWKS
curl -s https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json | tee /tmp/jwks.json

# Print the JWT you want to verify to a variable (paste between quotes)
JWT="<paste the JWT from 2.1 here>"

# Verify it in Node using only our public key — no server roundtrip
node -e "
  const signer = require('./src/sdk/attention-signer');
  const jwks = require('/tmp/jwks.json');
  signer.verifyJwt(process.env.JWT, jwks.keys[0]).then(r => {
    console.log(JSON.stringify({valid: r.valid, error: r.error, kid: r.header && r.header.kid}, null, 2));
  });
" JWT="$JWT"
```

**Expect:** `{ "valid": true, "kid": "sws-attention-2026-04" }`

**Why this matters:** You can tell any buyer "here's the JWT, here's our public key URL, verify it on your own machine — no SWS server involved." That's the whole point of offline-verifiable credentials. Prove you can do it; now any buyer can.

**Fail mode:** If this fails, it means the JWKS on the CDN is out of sync with the signing key. Regenerate by running the signing endpoint against the same `SWS_SIGNING_KEY` env var that produced the JWKS.

---

## Phase 3 — Adversarial validation (3 minutes)

This is where you prove that a bot gets a different outcome than a human.

### Step 3.1 — Run the bot harness
**Do:**
```bash
node proof/run-bot-vs-human.js
```

**Expect:**
- Three Puppeteer profiles (naive, jittered, puppeteer-stealth) each complete the demo
- Composite scores fall in the 0.48–0.54 range (well below your ~0.57)
- BotD environmental gate catches ≥1 of the 3
- Honeypot canary trips when the bot answers the text phase (because the bot ingests full DOM-including the hidden canary instruction — most commonly the naive and jittered bots will trip it)

**Fail mode:**
- If bots score ≥0.60: calibration broke; investigate `composite_score` weights
- If **none** trip honeypot: the canary isn't being injected on demo.html (check `proof/demo.html` for the `injectHtml` call)
- If BotD catches zero of three: `proof/vendor/botd.esm.js` may have failed to load — check Network tab in browser

### Step 3.2 — Side-by-side receipt comparison
**Do:** Open `proof/results/` and compare:
- `stephen-0573-anchored.json` (your real human session)
- Latest bot receipts from Step 3.1

**Expect:**
- Composite gap ~0.09 (you: ~0.57 / bots: ~0.48)
- **Crucial for your pitch:** honeypot and environmental fields differ dramatically. Your receipt: `environmental.bot: false`, `honeypot.tripped: false`. Bot receipts: at least one of `environmental.bot: true` or `honeypot.tripped: true`.

**This is the pitch fact you actually have:** the *receipt's layered evidence* separates bot from human *even when the composite score alone does not*. Buyers should never judge on the single number; they judge on the full layered attestation. That is why we pitch the receipt, not the classifier.

---

## Phase 4 — Regenerate the evidence kit (2 minutes)

### Step 4.1 — Fresh ZIP reflecting today's state
**Do:**
```bash
node scripts/generate-evidence-kit.js
ls -la dist/evidence-kit.zip
unzip -l dist/evidence-kit.zip
```

**Expect:**
- Exit 0
- ~25 KB ZIP
- 10 files listed including `README.md`, `part-11-mapping.md`, `sample-signed-receipt.json`, `verify-instructions.md`, `public-key.jwk.json`, `sample-xapi-statement.json`, `sample-openbadge.json`

**Why this matters:** This is the attachment on your cold email. It's what lets a QA team "qualify SWS in 10 minutes without a meeting." Never attach a stale one — regenerate before any outreach batch.

---

## Phase 5 — OpenTimestamps upgrade cycle (2 minutes)

### Step 5.1 — Refresh the Bitcoin anchor state
**Do:**
```bash
node scripts/upgrade-timestamps.js proof/results/stephen-0573-anchored.json
```

**Expect (if stamped >12h ago):**
- `bitcoin_confirmed: 1`
- Status flips from `pending` → `bitcoin_confirmed`
- A block height and block time populate

**Expect (if stamped <12h ago):**
- `still_pending: 1` — normal; re-run later

**Why this matters:** Once `bitcoin_confirmed`, anyone can verify that receipt existed at or before block N's timestamp — *without trusting us*. Stephen can re-run `verify.html` after this and see the green "BTC block #X" badge. This is the strongest claim in the whole system.

---

## What "passing" looks like

You have run this playbook successfully when **all of the following are true** simultaneously:

- [ ] 708 tests green
- [ ] verify.html correctly verifies a known-good JWT and shows the 7-layer grid
- [ ] A fresh session you just ran produces a JWT that also verifies
- [ ] `node -e "signer.verifyJwt(...)"` returns `valid: true` offline from just the public key
- [ ] Bot receipts clearly differ from your human receipt on environmental + honeypot fields
- [ ] Evidence kit ZIP regenerates cleanly
- [ ] OpenTimestamps upgrade either flips a pending receipt to confirmed OR reports pending gracefully

**If all seven boxes check: you are ready to pitch.** You have seen the product survive a full round-trip end-to-end, you have watched an independent verifier accept its output, and you have watched a bot fail visibly where you did not. Whatever a buyer asks, you have executed the proof yourself.

**If any box fails:** do not pitch yet. Fix it. Come back to this playbook. Pitching a product that fails its own playbook is the single worst outcome available to you right now.

---

## Quick-reference cheat sheet (copy this to a card before calls)

| Want to show... | Run this | URL |
|---|---|---|
| "A signed receipt verifies in your browser" | verify.html + paste known JWT | sws-attention-proofs.web.app/verify.html |
| "A humanness credential proves person-hood without PII" | prove-humanness.html + sample JWT | sws-attention-proofs.web.app/prove-humanness.html |
| "Our server never touches this verification" | Offline Node verify (Phase 2.3) | localhost only |
| "Bots fail differently than humans" | run-bot-vs-human.js | localhost only |
| "21 CFR Part 11 clauses are mapped" | part-11.html | sws-attention-proofs.web.app/part-11.html |
| "Any LMS can ingest this" | sample-xapi-statement.json in evidence kit | evidence-kit.zip |
| "Any credentialing body can issue OB3 badges" | sample-openbadge.json in evidence kit | evidence-kit.zip |
| "Bitcoin-anchored, not just our word" | OTS-confirmed stephen-0573 receipt | verify.html (Layer 6a) |
| "Pharma-regulator-familiar timestamps" | RFC 3161 layer of a receipt with `tsa` | verify.html (Layer 6b) |

**Last updated:** 2026-04-21 · after the Apr 21 audit-hardening sprint.
