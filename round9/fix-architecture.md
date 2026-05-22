# Round 9 — Challenge-Bound Attestation: Architecture Spec

**Status:** DESIGN ONLY. No production source modified. This document is the
buildable spec for the fix; it does not itself fix anything.

**Scope of the break (Round 9):** all 3 hostile vectors returned BROKE-HARD.
Three agents converged independently on the same root cause:

> The server recomputes a score from an attacker-controlled event-log input
> that is **never bound to a real, server-timed session**. `serverRecompute`
> validates *statistical plausibility* (timing CV in a band, motion exists,
> keystroke CV not too flat, duration roughly matches). It never validates
> *provenance* — that these events were produced by a live browser doing a
> task the server randomly chose and timed. An attacker who can synthesize a
> statistically-plausible `event_log` JSON object and POST it (or write the
> Firestore `demos/{id}` doc) walks through THE WALL, because every gate the
> WALL applies is a property of the *numbers in the log*, not of *where the
> log came from*.

This is correct and it is the real problem. `featureFingerprint` /
trace-novelty does not close it either: novelty only catches *reused* traces.
A fresh synthetic trace per receipt is novel by construction. The
adversarial-bot-builder's documented bypass ("must ALSO ship a coherent event
log") was always the ceiling of this design, and Round 9 demonstrated the
ceiling is reachable for ~$0 of marginal cost once the synth is written.

The fix below is the owner's framing, which is sound: a server-issued
**LOCK** (challenge) and a session-bound **KEY** (the SDK weaving the
challenge through the event stream) such that signals **cannot be set
independently** of a specific, server-timed, server-randomized task.

---

## 0. Threat model — what we are actually defending against

| Attacker class | Pre-Round-9 cost | What this spec does to them |
|---|---|---|
| **A. Forge composite, no log** | already caught (`event_log_absent`) | unchanged — still caught |
| **B. Forge composite, hand-write a plausible log** (Round 9 PoC #1, #2) | ~$0 marginal | **CLOSED** — log must satisfy server-issued challenge structure it cannot predict |
| **C. Record one real human, replay with jitter** | ~$5/trace | partially closed by trace-novelty; **fully closed** here — replayed trace cannot satisfy a *fresh random challenge* |
| **D. Drive a real headless browser through the real randomized task** | not yet attempted | **NOT stopped.** Raised TO this. This is the explicit, honest new floor. |
| **E. White-box attacker who reads SDK source, synthesizes events that satisfy the challenge invariants without a browser** | n/a | **NOT fully stopped.** Raised in cost (must reverse-engineer + reproduce causal invariants per challenge); see §C. |

The honest one-sentence statement of the new bar:

> **After this fix, every accepted `server_attested` receipt requires the
> attacker to have driven a real, instrumented, server-randomized session
> end-to-end (class D). It does not stop class D. It converts "write a JSON
> blob" into "drive a randomized browser session per receipt."**

That is a real and large cost increase (orders of magnitude in per-receipt
marginal cost and engineering), and it is the maximum a client-side
behavioral protocol can structurally achieve without server-side rendering or
remote attestation hardware. We should not claim more.

---

## 1. LOCK — server-issued signed challenge

### 1.1 New endpoint: `POST /issueChallenge`

New Cloud Function export in `proof/functions/index.js`, sibling to
`signReceipt`. Stateless-issue / stateful-verify design (the issued
challenge is also written to a short-TTL Firestore collection so the
verify step can detect replay and enforce single-use).

**Request** (minimal; no PII):

```
POST /issueChallenge
{ "site_id": "<deployer key>", "client_nonce": "<128-bit hex from SDK>" }
```

**Response** — a signed challenge token (compact JWS, same Ed25519 key /
`kid` as receipts, distinct `typ`):

```
challenge_jwt = b64url(header).b64url(payload).b64url(sig)

payload = {
  "typ": "sws-challenge",
  "cid":  "<128-bit server random hex>",      // challenge id (server nonce)
  "site": "<site_id>",
  "cn":   "<echo of client_nonce>",           // binds client identity
  "iat":  <server unix seconds>,              // server timestamp — authoritative
  "exp":  <iat + CHALLENGE_TTL_SEC>,          // default 900s (15 min)
  "perturb": {
     "v": 1,
     "reflect_prompt_id": <int 0..R-1>,       // which reflection prompt
     "reflect_token": "<6-char server word>", // must appear verbatim in reflection
     "task_order": [<perm of [1,2,3,4,5]>],   // required phase order this session
     "target_seq": [<int 0..35> * N_TARGETS], // exact lit-cell sequence for Fitts task
     "target_grid": { "cols": <4..8>, "rows": <4..8> }  // randomized geometry
  }
}
```

`cid` is the server nonce. `iat` is the **authoritative** session start —
the SDK's own `started_at` becomes advisory only. `perturb` is the
per-session randomized task the SDK MUST realize.

### 1.2 Challenge-space size (precompute / lookup-table resistance)

The attacker must not be able to precompute, for every possible challenge, a
matching synthetic event log. The perturbation space:

| Component | Cardinality |
|---|---|
| `reflect_prompt_id` | R = 64 prompts |
| `reflect_token` | 64-token dictionary, 1 chosen → 64 |
| `task_order` | 5! = 120 permutations (subject to constraint: reading before quiz — see §B.4; effective ≈ 60) |
| `target_seq` | grid_cells ^ N_TARGETS. With 36 cells, 12 targets → 36^12 ≈ 4.7×10^18 |
| `target_grid` | 5 col × 5 row = 25 geometries |
| `cid` | 2^128 (not enumerable; this is the anti-replay anchor) |

The dominating term is `target_seq` (~10^18) — far beyond any lookup table.
But cardinality alone is **not** the security property; an attacker doesn't
precompute a table, they *generate on demand*. The real security property is
in §C: the server checks **causal invariants tying the events to THIS
`cid`'s perturbation**, which a generator must reproduce per challenge.
Cardinality only guarantees the attacker cannot ship one static trace and
have it match many challenges (it matches ~none).

### 1.3 Replay / expiry / single-use

Three independent controls:

1. **Expiry:** `verify` rejects if `now > challenge.exp` or
   `now < challenge.iat - CLOCK_SKEW (30s)`. `CHALLENGE_TTL_SEC = 900`.
   Also enforce a **minimum** elapsed: a `server_attested` session must have
   `receipt_submit_time - challenge.iat >= MIN_SESSION_SEC (45s)`. A receipt
   that arrives 3 seconds after the challenge issued did not do the task.
2. **Single-use:** on issue, write `challenges/{cid}` =
   `{ site, iat, exp, client_nonce, consumed:false }` (Firestore, TTL policy
   on `exp`). On verify, transactionally read+set `consumed:true`; if already
   `true` → reject `challenge_replayed`. This makes one challenge → at most
   one `server_attested` receipt.
3. **Binding:** `challenge.cn` must equal the `client_nonce` the SDK weaves
   into the log (§B). `challenge.site` must equal the submitting deployer.
   A challenge issued for site A cannot be spent by site B.

### 1.4 Files changed (LOCK)

| File | Function / area | Change |
|---|---|---|
| `proof/functions/index.js` | NEW `exports.issueChallenge` | `onRequest`, CORS, uses `SIGNING_KEY`/`SIGNING_KID`. Generates `cid` (crypto.randomBytes 16), builds `perturb`, signs with existing `signPayload` (add `typ` to header), writes `challenges/{cid}`. |
| `proof/functions/index.js` | NEW `buildPerturbation(siteId)` helper | Pure function: draws prompt id, token, task order (constraint-respecting), target sequence, grid dims from `crypto.randomBytes`. Exported for unit test. |
| `proof/functions/challenge.js` | NEW module | `buildPerturbation`, `verifyChallengeToken(jwt, pubkey)`, `assertChallengeFresh(cid, admin)`. Isolated like `sanitize.js` so it is testable without firebase-functions. |
| `proof/firestore.rules` | NEW `match /challenges/{cid}` | Deny all client reads/writes (admin/function-only; functions use Admin SDK which bypasses rules). Mirrors `session_fingerprints` posture. |
| `proof/firestore.indexes.json` | TTL field | Document `exp` as the TTL field for the `challenges` collection (TTL policy is a console/gcloud action — see migration §D). |
| `proof/functions/index.js` | header comment block | Document the new endpoint in the file banner. |

---

## 2. KEY — how the SDK weaves the challenge through the event log

The SDK must (a) fetch a challenge **before recording starts**, (b) realize
the perturbation in the actual task UI, and (c) emit the `cid` and
challenge-derived structure *inside the event stream* so the server can
verify the events were produced *against this challenge*.

### 2.1 New SDK lifecycle

`SWSAttention.init()` gains a pre-flight step:

1. Generate `client_nonce` (existing `_generateNonce` is **insufficient** —
   `Date.now()+Math.random()` is low-entropy and predictable; introduce
   `_generateSecureNonce()` using `crypto.getRandomValues`, 16 bytes hex).
2. `POST /issueChallenge` with `{site_id, client_nonce}`.
3. Hold `_challenge = response` (the full signed JWT + decoded `perturb`).
4. Do **not** begin event recording until the challenge is held. If the
   issue call fails, the SDK records anyway but the resulting receipt is
   structurally `client_attested_*` (no `cid` → cannot be `server_attested`).
   This is the back-compat fallback (§D) — never a hard failure for the user.

### 2.2 event-log.js changes

`proof/sdk/event-log.js`:

| Area | Change |
|---|---|
| `createEventLog(opts)` | Accept `opts.challenge` = `{ cid, jwt, perturb }`. Store `cid`, `challengeJwt`. |
| `snapshot()` output | Add top-level fields: `cid` (string), `challenge_jwt` (string, opaque — server re-verifies), `challenge_bound: true/false`. |
| NEW method `markPhase(phaseId, tStart, tEnd)` | Records `{ type:'phase', t, p:phaseId, edge:'enter'|'exit' }` events. This is how task-order is provable from the stream. |
| NEW method `markTarget(seqIndex, cellId, litT, hitT)` | Records `{ type:'tgt', t, seq:seqIndex, cell:cellId, lit:litT }` on each Fitts hit. This is how `target_seq` is provable. |
| NEW method `markReflectToken(present:boolean, tFirstSeen)` | Records `{ type:'rtok', t, ok:present }` once, when the reflection field's running value first contains `reflect_token`. **Never stores the token or the text** — only the boolean and timestamp. Privacy posture preserved (matches bipa-posture.md). |
| `record(ev)` | Mix `cid` into the existing FNV mousemove-sampling hash seed so the *sampling decision itself* is challenge-specific. An attacker replaying a trace under a different `cid` gets a different retained-event subset → breaks any precomputed alignment. Cheap, deterministic, no `Math.random`. |
| Anchor logic | First `phase` enter event and the `cid` are anchored (never evicted) so flood-eviction cannot strip provenance. |

The privacy invariant is unchanged: no key characters, no DOM ids, no
reflection text, no quiz answers. `rtok` carries one boolean. `tgt`/`phase`
carry only indices the *server already chose*.

### 2.3 attention-protocol.js changes

`proof/sdk/attention-protocol.js`:

| Area | Change |
|---|---|
| `_generateSecureNonce()` | NEW. `crypto.getRandomValues(new Uint8Array(16))` → hex. Used for `client_nonce`. Keep `_generateNonce` for the legacy per-hash field (not security-load-bearing there). |
| `init()` (≈ line 2900) | Add async pre-flight: fetch challenge, pass into `createEventLog({challenge})`. Expose `_challenge` to the host page via a getter `SWSAttention.getChallenge()` so demo.html can drive the perturbation UI. |
| `generateContentReceipt` (≈ line 3046) | Add to canonical `payload`: `challenge_jwt: _challenge ? _challenge.jwt : null`, `cid: _challenge ? _challenge.cid : null`. These are inside `canonical` → already covered by the existing SHA-256 receipt hash, so tampering breaks verification (same property the comment at line 3086 already claims for `event_log`). |
| `_buildPayload` nonce | leave as-is (not security-load-bearing — it's per-hash dedupe). |

### 2.4 demo.html / cme-demo.html changes (the perturbation realizer)

The host page must *actually realize* the randomized task. This is the part
that makes the invariants real instead of cosmetic.

`proof/demo.html`:

| Area | Change |
|---|---|
| Task gating (≈ line 938 phase swap) | Read `SWSAttention.getChallenge().perturb.task_order`; present phases in that order; call `_eventLog.markPhase()` on every phase enter/exit. |
| `nextTarget()` (≈ line 1003) | Replace `Math.floor(Math.random()*totalTargetCells)` with `perturb.target_seq[targetCount]`. Build the grid with `perturb.target_grid.cols/rows` instead of fixed 6×6=36. Call `_eventLog.markTarget(targetCount, cell, litT, hitT)` in `hitTarget()`. |
| Reflection prompt (phase-4, ≈ line 210) | Render prompt text by `perturb.reflect_prompt_id` from a 64-entry prompt table (the table is **public**, ids are server-chosen). Display an instruction: "include the word **`<reflect_token>`** somewhere in your answer." On `input`, when `value` first contains the token, call `_eventLog.markReflectToken(true, Date.now())`. |
| Quiz set | Optionally key the quiz subset by `cid` too (defense in depth; not required for the core fix). |

`proof/cme-demo.html`: same pattern on its own task surface (≈ line 721). If
a deployer's vertical has no reflection / Fitts task, see the deployer
contract §B-contract for the reduced-invariant mode.

---

## 3. VERIFY — server-side challenge-bound check (O(events))

Extend the WALL. All new logic in `proof/functions/server-scorer.js` plus a
small wiring change in `proof/functions/index.js`.

### 3.1 New: `verifyChallengeBinding(eventLog, claimedChallengeJwt, pubkey, admin)`

New function in `challenge.js`, called from `runWall` *before*
`serverRecompute`. Steps, all O(events) or O(1):

1. **Verify the challenge JWT** with the issuer Ed25519 public key
   (`crypto.verify`). Reject `challenge_sig_invalid` if bad. This is the
   crux: the perturbation is *server-signed*, so the attacker cannot mint
   their own easy challenge.
2. **Freshness/single-use:** `assertChallengeFresh(cid, admin)` — read
   `challenges/{cid}`, reject if missing / `consumed` / expired / site
   mismatch / `cn` mismatch. Transactionally set `consumed:true`.
3. **Bind log to challenge:** `eventLog.cid === challenge.cid` and the
   in-log `challenge_jwt` hashes equal to the submitted one. Reject
   `challenge_log_mismatch` otherwise.
4. **Time provenance:** `serverNow - challenge.iat ∈ [MIN_SESSION_SEC, exp-iat+skew]`.
   `eventLog.started_at` must be `>= challenge.iat - skew` (the session
   cannot have started before the server issued the challenge). Reject
   `session_predates_challenge` — this kills replay of any trace recorded
   before the challenge existed.
5. **Causal-invariant checks against `perturb`** (the heart — see §3.2).

### 3.2 Cross-signal causal invariants (the "entanglement")

These are what make signals impossible to set independently. Each is a cheap
single pass over `events` (O(n)). A synthetic log must satisfy *all*
simultaneously, and they reference *this `cid`'s* random parameters:

| Invariant | Check (O(events)) | Why an independent forger fails |
|---|---|---|
| **I1 Task order** | The ordered sequence of `phase` enter events must equal `perturb.task_order`. | Attacker who didn't read `perturb` emits phases in default order; mismatch. |
| **I2 Target sequence** | Each `tgt` event's `seq` is monotonic 0..N-1 and `tgt[k].cell === perturb.target_seq[k]`. | The lit-cell sequence is 1-of-36^12; a generic motion synth lands on wrong cells. |
| **I3 Fitts geometry coupling** | For each consecutive `tgt` pair, the inter-target Euclidean distance implied by `perturb.target_grid` + cell ids must correlate with the *observed inter-`tgt` mousemove path length and the inter-hit Δt* (Fitts: longer moves take longer). Coarse check: rank-correlation of (implied distance) vs (observed Δt) over the N targets must be > 0.3. | This is the **entanglement**: motion timing must track a geometry the server randomized *after* the attacker's synth was written. Faking clicks at the right cells but with constant timing breaks the correlation; faking timing without the right cells breaks I2. They cannot be set independently. |
| **I4 Reflection token causality** | If `rtok.ok===true`, its `t` must fall **inside** the phase-4 (reflection) enter/exit window AND after ≥ some keystrokes (`kd`) within that window. `composition_integrity.verdict==='authored'` must be consistent with ≥ N keystrokes in that window. | A paste-bot that injects `rtok:true` at an arbitrary time fails the windowing; a no-keystroke log claiming the token was typed fails the keystroke coupling. |
| **I5 Click ↔ target binding** | Every `click` event during the Fitts phase must be within a bounded radius of the lit cell's geometric center (cell center computable from `perturb.target_grid`). Allow generous slop (cell is ≥44px; accept within 1.5×cell). | Clicks "somewhere" don't satisfy a server-chosen cell layout. |
| **I6 Monotonic server-time envelope** | All event `t` within `[started_at, started_at+duration_ms]` and `duration_ms` consistent with `(serverNow - challenge.iat)` within tolerance. | Decouples the log's self-reported clock from server truth. |

`verifyChallengeBinding` returns
`{ ok, reason, invariants:{I1..I6 pass/fail}, challenge_bound:true }`.

### 3.3 runWall integration

`proof/functions/server-scorer.js#runWall`:

- New first step (when `sessionMeta.challengeJwt` present): call
  `verifyChallengeBinding`. Push a `bounds_violation` of
  `challenge_binding_failed:<reason>` and the specific
  `invariant_failed:I3` etc. on any failure.
- **Trust-tier rule change:** `server_attested` now requires
  `verifyChallengeBinding.ok === true` **in addition to** the existing
  `serverRecompute.ok && !divergent && boundsViolations.length===0`. Add a
  new intermediate tier `server_recompute_only` for the legacy/no-challenge
  path (was effectively `server_attested` before — it must be **downgraded**;
  see §D migration).
- `extractSessionMetrics`: extract `challengeJwt` from
  `session.event_log.challenge_jwt` || `session.receipt_payload.challenge_jwt`
  || `session.challenge_jwt`, and `cid` likewise. Same dual-path discipline
  the R8-NEW-3 nested-event_log fix already established.

### 3.4 index.js wiring

- `signReceipt` and `onSessionWritten` already call
  `scorer.runWall(meta, {admin})`. No structural change — `runWall` does the
  new work internally. Add `cid` + challenge invariant summary to the signed
  `walledOutcome` (so offline verifiers see `trustTier:'server_attested'`
  *only* when challenge-bound). Update `buildCredential` in `index.js` to
  embed `hv.challengeBound` and `hv.challengeId` (cid) — same pattern as the
  existing `hv.trustTier` embedding at line 145.

### 3.5 Cost: verification stays O(events)

Every invariant is one linear pass (I1/I4/I5/I6) or one pass + a Spearman
over N≈12 targets (I2/I3). JWT verify is one Ed25519 op. One Firestore
transactional read+write for single-use. No DOM, no per-event crypto. Total
added latency: dominated by the one Firestore transaction (~30–80ms),
acceptable for the existing trigger/HTTP path.

### 3.6 Files changed (VERIFY)

| File | Function | Change |
|---|---|---|
| `proof/functions/challenge.js` | NEW | `verifyChallengeToken`, `assertChallengeFresh`, `verifyChallengeBinding`, `cellCenter(gridDims, cellId)`, `spearman(a,b)`. |
| `proof/functions/server-scorer.js` | `runWall` | call `verifyChallengeBinding` first; new tier `server_recompute_only`; gate `server_attested` on challenge binding. |
| `proof/functions/server-scorer.js` | `extractSessionMetrics` | extract `challengeJwt`, `cid` (dual nested path). |
| `proof/functions/index.js` | `buildCredential` | embed `hv.challengeBound`, `hv.challengeId`. |
| `proof/functions/index.js` | issuer pubkey access | `verifyChallengeBinding` needs the **public** key; derive from the private `SIGNING_KEY` secret at function init (Node `crypto` can derive Ed25519 public from PKCS8 private) or read the published `/.well-known/attention-pubkey.json`. Prefer deriving from the secret to avoid a network dependency in the hot path. |

---

## 4. MINIMAL STOPGAP (tourniquet — ship before the real fix)

Separate, small, closes tonight's exact 3 PoCs in `server-scorer.js`. **This
is a tourniquet.** A white-box attacker who *also synthesizes motion* walks
straight through every one of these — they only raise the bar for the
specific lazy PoCs filed tonight, not for class B/D generally. Ship it the
same night; do not represent it as the fix.

All edits in `proof/functions/server-scorer.js`:

1. **Cap server_composite on `motionApplicable===false`.** In
   `serverRecompute`, after computing `serverComposite`, if
   `motionApplicable === false` then `serverComposite = Math.min(serverComposite, 0.65)`.
   Rationale: the motion-redistribution path (PoC #2) currently lets a
   no-motion log reach ~0.8+ purely on keystroke+density. Cap it so a
   no-motion forgery cannot reach the high-trust band. *Gap:* a forger who
   adds synthetic `mm` events flips `motionApplicable` true and the cap never
   applies. Hence stopgap #3.

2. **Require `serverRecompute.server_composite ≥ 0.75` for `server_attested`.**
   In `runWall` trust-tier resolution, add to the `server_attested`
   condition: `&& serverRecomputeResult.server_composite >= 0.75`. Today the
   tier only checks `ok && !divergent && no bounds violations` — a log
   engineered to land server≈client≈0.55 passes (PoC #1). A hard floor means
   a forged mid-band log lands at best `client_attested_bounds_clean`, not
   `server_attested`. *Gap:* attacker just engineers the log to score ≥0.75;
   the sub-scores are all attacker-reachable.

3. **Require a bound device-class assertion before `motionApplicable` can
   flip to false.** `motionApplicable` is currently inferred purely from the
   log (`no_motion && (keystrokes≥10 || scroll≥20)`). Add: only honor
   `motionApplicable=false` if `sessionMeta.environmental` carries an
   explicit `device_class ∈ {'mobile','keyboard_only'}` *and* (post-real-fix)
   that field is inside the challenge-bound canonical hash. As a pure
   stopgap (pre-real-fix) it's just an unbound self-assertion — honestly,
   near-zero added attacker cost; included only because the real fix needs
   the field to exist and be plumbed. Mark it `// STOPGAP — unbound until
   challenge binding lands`.

4. **Fix the `duration_sec` string-coercion asymmetry.** `serverRecompute`
   receives `claimedDurationSec` and does `durationDelta / claimedDurationSec`
   and `claimedDurationSec === 0`. If a caller passes the string `"0"`,
   `=== 0` is false (no early-out) but the division coerces, and
   `"300"`-style strings make `durationDelta/claimedDurationSec` do string
   math edge cases. `extractSessionMetrics` already `Number()`-coerces
   `durationSec`, but `serverRecompute` is also called directly (tests, and
   any future caller) with raw values. Add at the top of `serverRecompute`:
   `claimedDurationSec = Number(claimedDurationSec); if (!Number.isFinite(claimedDurationSec) || claimedDurationSec < 0) claimedDurationSec = 0;`
   Symmetric with the existing composite clamp. Low attacker value but it's a
   correctness asymmetry the Round-9 stats agent flagged and it's a one-liner.

**Stopgap test additions** (`tests/server-scorer.test.js`): one test per PoC
asserting the lazy variant now lands `client_attested_*` not
`server_attested`. These tests must be written to *also* document, in a
comment, the synthesize-motion bypass so the limitation is not lost.

**Honest statement to put in the commit body:** *"Stopgap closes the three
specific Round-9 PoCs (no-motion redistribution over-credit, mid-band forged
log reaching server_attested, duration string-coercion). It does NOT close
the convergent root cause. A white-box attacker who synthesizes motion events
plus a mid-band consistent log still reaches server_attested. The real fix is
challenge binding (this document §1–3)."*

---

## 5. Deployer integration contract & added burden

Today a site embeds one script tag and calls
`SWSAttention.generateContentReceipt`. Challenge binding **changes the
integration contract**. This is the real cost of the fix and must be stated
plainly to any prospect.

### 5.1 What the deployer must now do

1. **Network:** allow the SDK to reach `POST /issueChallenge` (one extra call
   per session, before recording). Adds one round-trip to session start
   (~100–300ms). CSP / connect-src must include the functions origin.
2. **Realize the perturbation in their task UI.** This is the hard part.
   The deployer's content flow must:
   - present interaction phases in `challenge.perturb.task_order`;
   - if they use the SDK's Fitts/target task, drive it from
     `perturb.target_seq` + `perturb.target_grid`;
   - if they collect a free-text reflection, show the server's prompt id and
     require the `reflect_token`.
3. **Call the new SDK marker methods** (`markPhase`, `markTarget`,
   `markReflectToken`) at the right lifecycle points, OR adopt the SDK's
   built-in task widget (we should ship a drop-in `SWSAttention.renderTask()`
   that does all of this so a deployer with no task of their own gets it for
   free).

### 5.2 Reduced-invariant mode (honest)

Many real verticals (ad view, video watch, doc read) have **no reflection
and no Fitts task**. For them, the strong invariants I2/I3/I4/I5 don't
apply. The contract for those deployers:

- They still get LOCK (signed `cid`, server time, single-use, expiry) and
  invariants **I1 (phase order, if they have ≥2 phases), I6 (server-time
  envelope), and the freshness/replay controls**.
- They get a clearly weaker tier: `server_attested_reduced` — provenance of
  *timing and single-use* is established, but not the motion↔geometry
  entanglement. This is **honestly weaker** than full `server_attested` and
  must render differently in verify.html and be documented in the
  integration guide. A reduced-mode receipt resists replay and "JSON blob
  with no browser," but a headless browser that idles for 45s then submits a
  plausible passive log can still earn it. We must not sell reduced mode as
  equivalent.

### 5.3 Burden summary (state this to prospects verbatim)

> "Strong challenge binding requires an interactive task surface (a
> reflection or a targeting interaction) the SDK can randomize. For
> attention/ad/video verticals with no interactive task, you get replay-proof
> + server-timed receipts but not the full motion-entanglement tier. Adding
> the full tier means adding (or letting us render) a short randomized
> interaction step in your flow."

That is a genuine product cost. It is the price of closing the root cause and
it should inform vertical prioritization (credentialing/CME, which already
has reflection + quiz, is the natural fit; passive ad-view is not).

---

## 6. Migration / back-compat for already-issued receipts

1. **Already-signed receipts (in the wild, JWTs already minted):** unchanged
   and still verify cryptographically. They carry no `cid` /
   `hv.challengeBound`. Verifiers (verify.html, verify-offline.js,
   prove-humanness.html) must be updated to render:
   - `hv.challengeBound === true` → "Server-attested (challenge-bound)" green.
   - `hv.trustTier === 'server_attested'` **without** `challengeBound`
     (legacy, pre-fix) → **downgrade display** to "Server-recompute only
     (legacy, not challenge-bound)" amber. Do **not** retroactively call old
     receipts forged — they predate the control — but stop showing them at
     the top trust label.
2. **Tier rename:** the old `server_attested` (recompute + bounds clean, no
   challenge) becomes `server_recompute_only`. Add a back-compat mapping in
   verifiers so an old JWT literally containing `"trustTier":"server_attested"`
   is *displayed* as `server_recompute_only`. The signed value can't change
   (immutable JWT) — handle at render/verify time.
3. **SDK rollout window:** SDKs that haven't updated (no `/issueChallenge`
   call) produce `challenge_jwt:null`. `runWall` routes these to
   `server_recompute_only` / `client_attested_*`. **No user-facing breakage,
   no failed sessions** — they just can't reach the new top tier until the
   deployer updates. This matches the existing `event_log_absent` graceful
   path philosophy.
4. **Challenge endpoint outage:** if `/issueChallenge` is down, SDK proceeds
   without a challenge (logs, records, submits) → `server_recompute_only`.
   The May-7 silent-signing-outage lesson applies: add `/issueChallenge` to
   `wireSmokeTest` (issue → verify a self-challenge end to end every 6h) so a
   challenge-path outage is not silent.
5. **Firestore TTL:** the `challenges` collection needs a TTL policy on `exp`
   (gcloud/console action, like the documented trace-novelty index +
   `firestore.indexes.json`). Without it the collection grows unbounded. This
   is an operational migration step, not code — must be in the deploy
   runbook, and the cost estimate is conditional on it (same caveat pattern
   as the Round-6 composite-index note).

---

## 7. Pre-registered pass/fail bar for the Round-9 re-test

Register this **before** re-running, so the re-test cannot be tuned to pass.
A re-test PASSES the challenge-binding fix iff **all** of the following hold
on a clean deploy with the real fix (not the stopgap):

**Must-block (all 5 must return BLOCKED / non-`server_attested`):**

1. **B-static:** attacker submits a hand-written statistically-plausible
   `event_log` with **no** `challenge_jwt`. Expect tier ≤
   `client_attested_*`, never `server_attested`/`server_attested_reduced`.
2. **B-stale-challenge:** attacker fetches a real challenge, waits past
   `exp`, submits a synthetic log referencing that `cid`. Expect
   `challenge_binding_failed:expired`.
3. **B-replay-challenge:** attacker spends one valid `cid` for a real
   session, then submits a *second* receipt reusing the same `cid`. Expect
   second → `challenge_replayed`, not `server_attested`.
4. **B-wrong-perturb:** attacker drives a real browser session but ignores
   the perturbation (default task order, random target clicks, no reflect
   token). Expect ≥2 of `invariant_failed:I1/I2/I3/I4/I5`.
5. **B-recorded-replay:** attacker replays a previously *recorded genuine
   human* event log under a *fresh* challenge `cid`. Expect
   `session_predates_challenge` and/or `invariant_failed:I2` (the recorded
   trace's cells/order don't match the new random `perturb`).

**Must-pass (all 3 must return `server_attested` and not be false-flagged):**

6. **H-desktop:** a genuine human completes the real randomized task on
   desktop (motion + reflection w/ token + correct target order). Expect
   `server_attested`, all I1–I6 pass.
7. **H-keyboard-only:** a genuine keyboard-only user (no mouse) with
   `device_class:'keyboard_only'` bound in the challenge canonical. Expect
   `server_attested` via the redistribution path *and* I1/I4/I6 pass; I2/I3/I5
   correctly N/A (no Fitts motion) without dropping the tier.
8. **H-reduced:** a genuine passive reading session on a reduced-mode
   deployer (no Fitts/reflection). Expect `server_attested_reduced` (NOT full
   `server_attested`, NOT `client_attested`).

**Numeric gates:**

- False-positive rate on a ≥20-session genuine-human corpus (the existing
  clan/friends corpus tags) for must-pass classes: **< 5%** flagged as
  `challenge_binding_failed`.
- Cost re-estimate by the adversarial-bot-builder agent must explicitly state
  the per-receipt marginal cost is now "drive one real instrumented
  randomized browser session" and give an order-of-magnitude $/receipt and
  hours-of-engineering figure, replacing the current $5-20k/mo+200-400h line.

**Auto-FAIL the whole re-test if:** any single must-block case returns
`server_attested` OR any must-pass case is false-flagged above the 5% gate OR
the bot-builder demonstrates a no-browser synthetic that satisfies I1–I6 for
a fresh random `cid` (that would mean the invariants are reproducible
without a browser — the spec failed and we go back to design).

---

## 8. Brutally honest gaps & things I'm unsure of

1. **Class D is not stopped, by design.** A real headless browser
   (Puppeteer/Playwright) driving the *actual* randomized task — reading the
   `perturb`, clicking the server-chosen cells with synthesized but
   Fitts-plausible motion, typing the reflect token — will earn
   `server_attested`. This spec's honest claim is *only* that it forces
   exactly that. Whether "drive a real randomized session per receipt" is
   expensive enough depends on the buyer's threat model and is **not provable
   from this design alone** — it needs the bot-builder to actually attempt
   class D and measure. I am not confident of the dollar figure until that
   measurement exists.

2. **I3 (geometry↔timing correlation) is the load-bearing invariant and the
   one I'm least sure survives a competent attacker.** A bot that knows the
   grid geometry can *generate* Fitts-plausible inter-target timings (the
   Fitts model is public, ~3 lines of code). Then I3's rank-correlation
   passes. I3 raises the bar (the synth must now be geometry-aware per
   challenge) but does **not** make synthesis impossible. The real strength
   is the *conjunction* I2∧I3∧I5∧I4 under a fresh random `cid` per receipt —
   each is individually beatable, the set is expensive to satisfy
   simultaneously without just running the task. This is a cost argument, not
   an impossibility argument. We must say so.

3. **Reduced-invariant mode is genuinely weak** and covers exactly the
   verticals (ad/video/passive) some GTM material has emphasized. The fix is
   strong precisely where there's an interactive task (CME/credentialing).
   This should *reinforce* the existing memory note that credentialing is the
   primary wedge — the security architecture and the GTM wedge agree.

4. **Clock trust.** `challenge.iat` is server-issued (good), but the
   *duration* of the session is still inferred from event timestamps the
   client controls; we only bound it by `serverNow - iat`. A bot can make a
   45s real wall-clock window look like a rich 5-minute session in the log's
   internal `t` values, as long as the *envelope* (I6) and the
   `serverNow-iat` window are satisfied. I6 catches gross mismatch, not a
   bot that simply waits the real `MIN_SESSION_SEC`. Tightening this needs
   periodic mid-session server pings (heartbeat with rolling server nonces) —
   noted as a **follow-on (Round 10 candidate)**, deliberately out of scope
   here to keep verification O(events) and stateless-ish.

5. **`/issueChallenge` is a new unauthenticated endpoint** = a new DoS /
   challenge-farming surface. An attacker can mint unlimited challenges
   (cheap) and farm valid `cid`s. Single-use + expiry limit the *value* of a
   farmed challenge (still must do the task within 15 min, one receipt each),
   but rate-limiting `/issueChallenge` per IP/site is required and is **not
   designed here** — flagged as a required companion control.

6. **`crypto.getRandomValues` availability.** The secure client nonce assumes
   a modern browser. Ancient embedded webviews lacking it fall back to
   challenge-less mode (`server_recompute_only`). Acceptable but means the
   strong tier silently excludes some legitimate low-end mobile users — a
   real false-negative on the *trust tier* (not on access). Must be measured
   on the mobile corpus.

7. **I did not validate** that `crypto.createPublicKey` can derive the
   Ed25519 public key from the existing PKCS8 private secret in the Functions
   runtime without additional setup. The fallback (read published
   `/.well-known/attention-pubkey.json` at cold start, cache) is safe but
   adds a cold-start network dependency. Needs a spike before build.

8. **Test/own-caller breakage.** `serverRecompute` and `runWall` are called
   directly by ~6 test files with no challenge. The new `server_recompute_only`
   tier and the gating change will require updating
   `tests/server-scorer.test.js`, `tests/wall-credential.test.js`,
   `tests/wall-fanout.test.js`, and the empirical-validation test to assert
   the *new* tier names. This is mechanical but must be in the build plan or
   CI goes red and the change looks broken.

---

## 9. One-paragraph summary for the owner

The Round-9 break is real and the convergence is correct: the WALL checks
that the numbers in the event log *look* human, never that they *came from* a
real session the server controlled. The fix is your LOCK/KEY framing: a
server-signed, single-use, time-stamped challenge that also randomizes the
task itself (which prompt, which click targets, which order), the SDK weaves
that challenge id and the realized task structure through the event stream,
and the server re-derives the expected structure and rejects any log whose
clicks/keystrokes/motion aren't *causally tied to this specific random task*.
That converts the attack from "POST a JSON blob" to "drive a real,
randomized, instrumented browser session per receipt" — a large, honest cost
increase. It does **not** stop an attacker willing to actually run that
browser session, and it's genuinely weaker on passive verticals with no
interactive task (which argues, again, for credentialing as the wedge). Ship
the four-part stopgap tonight as a tourniquet (and say plainly it's a
tourniquet), then build §1–3 against the pre-registered §7 bar.
