# ZK Proof of Attention — Tractable, Defensible Novelty

Source: agent research synthesis 2026-04-26.

## Bottom line

ZK proof-of-attention is **tractable** (~6 weeks engineering for production), **technically sound** (Groth16 over BN254, ~6,000 R1CS constraints, 2–6s browser prover, 128-byte proof, ~1ms verifier), and **partially novel**.

Don't claim novelty on ZK + behavioral signals — ZKSENSE (2019) and Condrey arXiv:2603.00179 (Feb 2026) already published that frame. **Do** claim novelty on:

1. The **canonical 7-layer signal schema** as a fixed public statement
2. The **gated composite** (env × composition × honeypot) as the proof statement
3. **Pharma/CME-compliant selective disclosure** (audit-on-challenge) — eprint 2026/333 formalizes the primitives but no one has shipped a 21 CFR Part 11–compliant variant
4. The **dual-tracking gap** (bot-vs-human ≥ 0.273) as a public input — proof simultaneously certifies humanness AND model discrimination strength

## Recommended scheme

**Groth16 over BN254 + Circom + snarkjs** in browser.

- Trusted setup: existing Powers-of-Tau (Hermez) up to 2^15 — already done, just download
- Proof generation: **2–6 seconds** in modern browser WASM
- Verification: **~1–2 ms** server-side, 3 pairings
- Proof size: **128 bytes** (3 G1 points). Fits in a tweet.
- Witness generation: <100 ms
- Engineering: ~2–3 weeks prototype, ~6–8 weeks production hardening

## Circuit sketch

```
template AttentionProof(N) {
  signal input signals[N];           // 20 private signals
  signal input composite;             // private aggregate
  signal input nonce;                 // private salt
  signal input lowerBounds[N];        // public human-distribution lower
  signal input upperBounds[N];        // public human-distribution upper
  signal input threshold;             // public composite threshold
  signal output commitment;           // Poseidon(signals||composite||nonce)

  for (i=0; i<N; i++) {
     RangeCheck()(signals[i], lowerBounds[i], upperBounds[i]);
  }
  CompositeCheck()(composite, threshold);    // composite >= threshold
  RecomputeComposite()(signals, composite);  // composite is correct fn of signals
  commitment <== Poseidon(N+2)(signals, composite, nonce);
}
```

## Migration path from current SHA-256 receipt

1. Keep SHA-256 hash for content binding (current).
2. Add a parallel `proof.snark` field with the Groth16 proof + public inputs.
3. Verifier: hash check (current) + SNARK check (new). Both must pass.
4. Privacy mode: omit raw signals, ship only commitment + proof.
5. Audit mode: ship encrypted-to-auditor signals alongside (BBS+ envelope or Camenisch-Shoup verifiable encryption).

For incremental 7-layer proving: use **Nova folding** — each layer produces a fold step; final compressed SNARK is one Groth16/Spartan proof.

## Privacy vs auditability — the pharma tension

21 CFR Part 11 requires non-modifiable audit trails reconstructable by FDA inspectors. Pure ZK hides too much. **Hybrid architecture:**

1. Public ZK proof (composite ≥ threshold + each signal in human band) for sponsor dashboard
2. Encrypted commitment (auditor key) included in receipt
3. Selective disclosure on challenge — inspector challenges field signal_7 → user reveals Pedersen opening for that field only
4. BBS+ signatures over the canonical JSON give selective disclosure natively

Reference: eprint 2025/824 (Anonymous Credential System Using BBS+) + IOTA ZK-SD-VC spec.

## Direct prior art to cite

- **ZKSENSE (Papadopoulos, Querejeta-Azurmendi, arXiv 1911.07649, 2019)** — first ZK humanness over mobile motion sensors; 174.5s prover Galaxy S9; 92% accuracy. **The key prior art you must cite — almost exactly your framing on a different signal channel.**
- **Condrey arXiv:2603.00179 (Feb 2026)** — ZK over behavioral features for authorship verification. Cleanest published blueprint for what we're building.
- **eprint 2026/333 (Choudhuri, Garg, Lee, Montgomery, Policharla, Sinha — UC Berkeley + Hart Montgomery, Feb 2026)** — formalizes Personhood Credentials + Verifiable Relationship Credentials + ZK ideal functionalities. Anchor security proof to this formalism.

## Russian / Chinese / Israeli labs to watch

- **Israel — StarkWare (Tel Aviv)**: S-two browser-STARK prover (2025). Eli Ben-Sasson, Shahar Papini.
- **Israel — Aleph Zero / Cardinal Cryptography**: zkOS, EVM-compatible ZK privacy.
- **China — Tsinghua IIIS** (Andrew Yao group): UniZK ASPLOS '25 hardware accelerator. Long-term relevance.
- **China — USTC** (Pan Jianwei group): post-quantum ZK + device-independent quantum random beacons. Matters for protocol v2.
- **a16z crypto / Justin Thaler**: Lasso/Jolt sumcheck provers — could beat Groth16 on prover time within 12 months.

## Migration option scoring

| Path | Effort | Risk | Pitch value |
|---|---|---|---|
| Stay SHA-256 only | 0 | low | medium (already shipped) |
| Add Groth16 proof alongside SHA-256 | 6-8 weeks | medium | **high** — separates from BioCatch et al. |
| Add Nova-folding 7-layer ZK | 12-16 weeks | high | very high — unique |
| Add TEE attestation binding | 4-6 weeks | low-medium | high — silicon-anchored |

## Sources

- [ZKSENSE arXiv 1911.07649](https://arxiv.org/abs/1911.07649)
- [Condrey arXiv 2603.00179](https://arxiv.org/abs/2603.00179)
- [eprint 2026/333 — Cryptographic Framework for PoP](https://eprint.iacr.org/2026/333)
- [Holonym Human ID](https://developer.holonym.id/tech/human-id)
- [StarkWare S-two](https://starkware.co/blog/s-two-prover/)
- [Anon-Aadhaar](https://anon-aadhaar.pse.dev/)
- [snarkjs (iden3)](https://github.com/iden3/snarkjs)
- [Nova: Recursive ZK from Folding Schemes (eprint 2021/370)](https://eprint.iacr.org/2021/370)
- [BBS+ Anonymous Credentials (eprint 2025/824)](https://eprint.iacr.org/2025/824.pdf)
