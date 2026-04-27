# SWS Attention Protocol

> **Cryptographic proof-of-human-attention for the agentic web.** A SHA-256 receipt every regulated transaction can attach as evidence that a real human did the work — not an AI agent or bot.

[![Patent Filed](https://img.shields.io/badge/patent-SWS--PROV--001-informational)](#patent--ip) [![Live Demo](https://img.shields.io/badge/demo-sws--attention--proofs.web.app-2ea44f)](https://sws-attention-proofs.web.app) [![For Reviewers](https://img.shields.io/badge/for--reviewers-entry%20point-06b6d4)](https://sws-attention-proofs.web.app/for-reviewers.html)

> 🔍 **Technical reviewer?** [**sws-attention-proofs.web.app/for-reviewers.html**](https://sws-attention-proofs.web.app/for-reviewers.html) is the curated entry point — reading order by depth, the three questions I most want pushback on, the disclosures up front so you can probe what matters. No personalization required; share the URL freely.

---

## What this is

A 23-signal browser SDK (21 weighted + 2 diagnostic-only at weight 0) that captures behavioral evidence of human attention during a session, assembles it into a deeply key-sorted canonical JSON payload, and produces a tamper-evident SHA-256 receipt. The receipt is content-bound: every value displayed to the user is included in the hash, so any modification to a displayed score, signal, or verdict invalidates verification.

**This is not a classifier and not a CAPTCHA.** Existing vendors (BioCatch, HUMAN Security, Cloudflare Turnstile, DataDome, GPTZero, Proctorio…) sell verdicts. SWS sells **receipts** — a portable, hash-anchored record of what happened in-session that any auditor, regulator, or court can verify offline. To our knowledge no other vendor in the bot-detection / AI-detection / proctoring space ships a tamper-evident cryptographic receipt of session behavior.

## The thesis

Every regulated high-stakes interaction with a screen — a CME credit, a license-renewal exam, a compliance training, a legal-advice form, an ad impression a brand is paying for — needs an audit-grade record that a real human paid attention. AI agents and LLM-driven workflows make existing "engaged-time" metrics meaningless. The right primitive is a hash, not a score.

## Seven layers

The protocol's confidence does not rest on a single classifier. It is gated across seven independent layers; any single layer caught means the receipt is downgraded to PASSIVE tier maximum.

1. **Environmental gate** — 7-vector multi-detector: `@fingerprintjs/botd v2` baseline + WebGL renderer (cloud-VM SwiftShader/llvmpipe signatures) + WebGPU adapter info (ACM WiSec 2025) + Function.toString native-code consistency + iframe-frontier comparison + chrome.runtime presence + AudioContext / OfflineAudioContext prototype-shape probe. Catches headless Chrome, Puppeteer, Playwright, Selenium, and the puppeteer-extra-stealth class adversaries that defeat BotD's standard heuristics.
2. **Behavioral composite** — 23 signals (21 weighted + 2 diagnostic-only) across motor, keystroke, decision, attention timing, reading, and cognitive-coherence domains. Current full description in [`SEVEN_LAYER_DEEP_DIVE.md`](SEVEN_LAYER_DEEP_DIVE.md) §2. The historical patent-prep pattern catalog (6-signal SDK state at filing time, March 2026) is in [`BEHAVIORAL_SCIENCE_PATTERNS.md`](BEHAVIORAL_SCIENCE_PATTERNS.md) — preserved unchanged because the patent claims reference its formulation.
3. **Composition integrity** — paste-burst detection, digraph-CV authenticity, sub-human typing intervals.
4. **Invisible honeypot canary** — bait words an LLM hallucinates but a human does not.
5. **Consent attestation** — explicit, revocable, GDPR Art. 7 / CCPA §1798.120 compliant.
6. **Cryptographic signature** — Ed25519 (RFC 8032) over W3C Verifiable Credential JWT, public key at `/.well-known/attention-pubkey.json`.
7. **Tamper-evident timestamp** — OpenTimestamps / Bitcoin anchor for proof-of-non-backdating.

[`SEVEN_LAYER_DEEP_DIVE.md`](SEVEN_LAYER_DEEP_DIVE.md) walks through each layer with the real numbers, the tradeoffs, and what we do not claim.

## The 23 behavioral signals

Each signal is a closed-loop biological invariant — verifiable with a small statistic and resistant to naive-bot mimicry. Composite gating means a bot has to fake all 21 weighted signals simultaneously, not one at a time. Two additional diagnostic-only signals (1/f cross-channel coherence, idle-window microsaccades) ride at weight 0 — measured and surfaced in the receipt for transparency but not contributing to the score until calibration matures against curve-aware adversaries.

| Domain | Signals |
|---|---|
| **Cognitive-motor invariants** | Fitts' Law (1954), Hick-Hyman Law (1952), Two-Thirds Power Law (Lacquaniti 1983) |
| **Temporal coherence** | Timing entropy (CV ≥ 0.4 is biological), 1/f / pink noise via prewhitened DFA-1 (Torre & Delignières 2008 — pre-empts Wagenmakers 2004 SRD critique), micro-pauses |
| **Reading rhythm** | Scroll saccade pattern (Rayner 1998), reading speed plausibility, hover dwell |
| **Mouse dynamics** | Curvature index, cursor jerk, velocity profile, Two-Thirds Power Law compliance |
| **Touch dynamics** | Touch/click variance, device motion (gyro/accel) |
| **Cross-signal coherence** | The anti-mimicry signal — bots can fake one channel; faking 20 mutually-consistent channels collapses to "build a human." Whitespace in literature; see [`docs/yc-defense/02_academic_sota.md`](docs/yc-defense/02_academic_sota.md). |

## Receipt structure

```json
{
  "protocol": "SWS-AP-v2",
  "patent": "SWS-PROV-001",
  "entity": "SWS Strategic Media LLC",
  "session_id": "demo_1777123764209_c13ebx",
  "duration_ms": 264000,
  "signals": { "timing": 0.904, "fitts": 0.800, ... 23 signals ... },
  "quality_tier": "active",
  "extras": { "source": "live_demo", "composite": 0.562, "device_type": "mobile", ... },
  "nonce": "..."
}
```

Hash = `SHA-256(canonicalJSON(payload))`. Canonical form is deeply key-sorted, recursive — see [`proof/sdk/attention-protocol.js`](proof/sdk/attention-protocol.js) `_canonicalJSON`. Verifier in [`proof/verify.html`](proof/verify.html) re-canonicalizes, re-hashes, and shows match/mismatch — independently auditable in any browser via WebCrypto.

## Independent verification

Three browser-side tools, no SWS server involved:

1. [**Receipt Explorer**](https://sws-attention-proofs.web.app/receipt-explorer.html) — paste any receipt JSON, see every layer of evidence: identity, gating-layer status, conformal Bayesian P(human), 23 behavioral signals, content-binding re-hash. Loads with a sample receipt so the page demos itself. The fastest way for an outsider to understand a receipt's anatomy.
2. [**Verify.html**](https://sws-attention-proofs.web.app/verify.html) — content-bound mode (paste canonical + hash) or issuer-attested mode (paste JWT). Uses WebCrypto (`crypto.subtle.digest` + `crypto.subtle.verify`).
3. [**CME demo**](https://sws-attention-proofs.web.app/cme-demo.html) — take a 5-minute CME activity yourself; the "Verify This Receipt" button at the end auto-prefills verify.html so the verification round-trip is one click.

## Where to read deeper

- [`SEVEN_LAYER_DEEP_DIVE.md`](SEVEN_LAYER_DEEP_DIVE.md) — the technical-reviewer document. What we know, what we don't, what we chose under uncertainty.
- [`ATTENTION_PROTOCOL_SPEC.md`](ATTENTION_PROTOCOL_SPEC.md) — formal protocol spec.
- [`BEHAVIORAL_SCIENCE_PATTERNS.md`](BEHAVIORAL_SCIENCE_PATTERNS.md) — patent-preparatory pattern catalog with scientific basis per signal.
- [`docs/yc-defense/`](docs/yc-defense/) — five docs covering competitive landscape, academic SOTA (top citations + papers to pre-empt), cognitive-invariants defense brief, YC pitch positioning, and CME signal-default diagnostics.

## Live demo

- **Public demo:** [sws-attention-proofs.web.app](https://sws-attention-proofs.web.app) — 5-phase attention test, generates a real receipt, posts to Firestore proof gallery.
- **CME-mode demo:** [sws-attention-proofs.web.app/cme-demo.html](https://sws-attention-proofs.web.app/cme-demo.html) — accredited-style activity with device-aware composite for mobile users.

Both are pure-browser; no native app needed.

## Running locally

```bash
npm install                                  # one-time
npx http-server proof -p 4000 -c-1           # serve the demo flow
# then open http://localhost:4000/cme-demo.html
```

### Tests

```bash
npm test                                     # full jest suite
node scripts/smoke-cme-local.js              # CME end-to-end + tamper-evidence proof
node scripts/smoke-demo-local.js             # demo flow end-to-end + round-trip
node proof/run-bot-vs-human.js               # adversarial harness (5 bot profiles)
```

Smoke tests assert: distinct hashes per session, mobile vs desktop receipt independence, signal-firing (no hardcoded defaults), canonical bytes match verifier, hash round-trips, and **tampering with one field changes the hash**.

## Adversarial robustness

Per the `2026-04-21` adversarial run (`proof/run-bot-vs-human.js`): the unaided behavioral composite shows narrow gap (0.011 vs LLM-Paster, our hardest profile). The **gated composite** — behavioral × environmental × composition × honeypot — widens the effective gap to **≥ 0.273 across all four tested bot profiles**. This number is published openly and reproducibly. To our knowledge no incumbent vendor publishes adversarial-robustness numbers at this level of specificity.

For the academic critique we pre-empt — Wagenmakers, Farrell, Ratcliff (2004) — see [`docs/yc-defense/03_cognitive_invariants_brief.md`](docs/yc-defense/03_cognitive_invariants_brief.md). The 1/f estimator uses Torre-Delignières prewhitened DFA-1, the canonical short-series substitute for full ARFIMA MLE.

## Patent & IP

Provisional patent filed: **SWS-PROV-001** (March 17, 2026). Assignee: SWS Strategic Media LLC.

## License

UNLICENSED — proprietary research and pre-commercial software. Contact for evaluation, pilot, or licensing inquiries.

## Contact

`stephenfurpahs@gmail.com`
