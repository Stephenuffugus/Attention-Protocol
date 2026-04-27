# Beyond-BotD Fingerprinting — Top 5 to Add to the Env-Gate

Source: agent research synthesis 2026-04-26.

## Bottom line

BotD ships ~12 heuristics, all defeated by puppeteer-extra-stealth, rebrowser-patches, and Nodriver. The frontier in 2024–2026: **side-channel hardware fingerprints** (WebGPU compute shaders, GPU cache attacks), **CDP-leak detection** (Runtime.enable side-effects), **TLS/network-layer fingerprints** (JA4/JA4T/JA4H), and **cryptographic attestation** (Private Access Tokens, WebAuthn UVPA). Stealth plugins cannot patch what they cannot reach.

## Top 5 to add (ranked by ROI = catch-rate × ease-of-implementation)

### 1. CDP Runtime.enable detector — HIGHEST ROI

~30 lines of JS. Catches every un-patched puppeteer/playwright/selenium-CDP bot. Setting custom getters on `Error.prototype.stack` triggers V8's CDP console; the side-effect is observable from the page.

- Disclosure: Antoine Vastel (DataDome, June 2024).
- Mitigations: rebrowser-patches and Nodriver work around it; older stealth plugins do not.
- Why it works: Puppeteer/Playwright must call `Runtime.enable` to discover ExecutionContextIds.
- **Status**: Highest single-fix value for our env-gate.

### 2. JA4 + JA4H at the edge

JA4 (FoxIO 2023) replaces JA3 by sorting extensions before hashing — survives Chrome's 2023 randomization. JA4+ suite: TLS client (JA4), server (JA4S), HTTP/2 SETTINGS (JA4H), TCP options (JA4T). Now standard at Cloudflare, AWS, VirusTotal.

- Stealth plugins live inside the JS engine — they **cannot touch the TLS handshake**.
- Stealth-puppeteer's JA4H (HTTP/2 frame order) often differs from real Chrome under user load.
- Implementation: front the receipt-storage endpoint with Cloudflare or run nginx with a JA4 module — gets the header for free.
- **Status**: Highest ROI for server-side enrichment.

### 3. WebAuthn UVPA + Private Access Token

The cryptographic family. Cloud-VM bots fail both. **The only category stealth plugins fundamentally cannot fake** — no enclave, no token.

- `isUserVerifyingPlatformAuthenticatorAvailable()` — returns true only on devices with biometric + TPM/Secure Enclave.
- **Private Access Tokens** (Cloudflare + Apple, 2022) — issued by device's Secure Enclave attesting humanness without revealing identity. Cloudflare auto-uses these to skip Managed Challenge.
- **Secure Payment Confirmation** — binds WebAuthn credential to hardware attestation.
- Browser support: UVPA: Chrome/Edge/Safari/Firefox; PAT: Safari iOS 16+, Chrome rolling; SPC: Chrome.
- **Status**: Aligns perfectly with our "proof of humanness" wedge. Adds a binary "hardware-attested human" bit to the composite.

### 4. WebGPU AtomicIncrement compute-shader probe

ACM WiSec 2025 paper "Unveiling Privacy Risks in WebGPU" — uses compute-shader scheduling to identify GPUs with **98% accuracy in 150 ms** (vs. 8 s for vertex-shader DRAWNAPART).

- Headless Chrome ships `--use-gl=swiftshader` by default → wildly different signature than real-Chrome on real GPU.
- Cloud-VM bots emit characteristic SwiftShader / Mesa-llvmpipe signatures.
- Reference impl: vektort13/User-Identification-WebGPU-Atomic-Browser-Fingerprint (GitHub).
- **Status**: 150ms latency, identifies real-GPU vs SwiftShader. Cheap and effective.

### 5. AudioWorklet + DynamicsCompressor signature consistency

Render an inaudible OscillatorNode → DynamicsCompressorNode → AnalyserNode graph and FFT the result. AudioWorklet adds new probes.

- Stealth plugins commonly **fail to spoof `audioContext.baseLatency` and `audioContext.outputLatency`** consistently with claimed device.
- Headless Chrome's nullsink audio backend produces a deterministic signature distinct from any real OS audio stack.
- Pair with creepjs's audio module.
- **Status**: Stealth plugins don't tamper with audio backend.

## Honorable mentions for v2

- **Canvas-emoji glyph hash** (WWW '25 paper) — needs an emoji corpus
- **Browser-extension passive probes** (CCS 2024) — only useful if anti-detect bots target you
- **JS-engine quirk panel** — cheap insurance, fold into creepjs

## What to drop / deprioritize

`navigator.webdriver`, plugin enumeration, `chrome` object presence — all defeated by every stealth plugin since 2022. Keep only as canary signals (their absence on a "real" UA is suspicious).

## Open-source libraries beyond BotD (ranked)

1. **CreepJS** (abrahamjuliot/creepjs) — gold standard, covers ~all of the above except JA4/PAT
2. **rebrowser-patches** (rebrowser/rebrowser-patches) — defense against, but reveals the Runtime.enable detector
3. **Castle's headless-detector** (andriyshevchenko/headless-detector) — 2025/2026 techniques, MIT
4. **fpscanner** (antoinevastel/fpscanner) — research-quality
5. **FoxIO JA4** (FoxIO-LLC/ja4) — network-layer
6. **Thumbmark.js** — light, 90-95% stable

## Key papers / posts on stealth-plugin defeats

- [Castle.io 2025](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/): combine Runtime.enable + JA4 + AudioWorklet
- [DataDome](https://datadome.co/bot-management-protection/detecting-headless-chrome-puppeteer-extra-plugin-stealth/): 40M/week stealth requests caught via JS fingerprint side-effects
- [IMC 2025 FP-Inconsistent](https://dl.acm.org/doi/10.1145/3730567.3732919): measures inconsistency across spoofed fingerprints (UA says Mac, GPU says Linux Mesa)
- [Vastel June 2024](https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/): original Runtime.enable disclosure
- Detection rates Oct 2024: stealth-Playwright 92%, stealth-Puppeteer 87% **success against basic systems** — only ~30-50% against systems combining JA4 + Runtime.enable + WebGPU
