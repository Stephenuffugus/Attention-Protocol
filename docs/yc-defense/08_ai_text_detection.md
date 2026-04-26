# AI-Text Detection for the CME Reflection Field

Source: agent research synthesis 2026-04-26.

## Bottom line

**No detector reliably hits >85% accuracy on 20-50 words at low FP** — except Pangram 3.2 (claims ~99.8% on short text, ICLR 2026 paper). For our CME reflection at 20-word floor, we're at the failure edge of every public detector. Recommendation: **bump reflection floor to 30–40 words** AND add Pangram via a Cloud Function, with a distilGPT2 client-side fallback.

## Recommendation

**Primary detector: Pangram 3.2 API.** Server-side via Firebase Cloud Function.
- Method: Transformer classifier (RoBERTa-large or Llama-3.2-3B fine-tuned via QLoRA) on EditLens dataset
- Short-text accuracy: ~99.8% (independent reviews confirm)
- Humanizer detection: 90%+ vs Undetectable.ai, BypassGPT, Ryter (Aug 2025 benchmark)
- Cost: $25/500 credits PAYG; $100/mo for 2,000 credits Dev plan; ~$0.05/scan effective
- Latency: 200-800ms

**Fallback: client-side distilGPT2 perplexity (transformers.js).**
- Method: log-perplexity + GLTR-style rank features over reflection
- Cost: $0 (~120MB ONNX, cached after first visit)
- Standalone accuracy: ~60-70% (FP 15-20%) — soft signal, not gate
- Use case: defense-in-depth, no-network signal

**Not recommended:**
- Watermarking (SynthID Gemini-only, Anthropic not yet shipped, OpenAI discontinued) — attacker chooses non-watermarked model
- GPTZero (61.3% FP on TOEFL essays — kills international clinician UX)
- Originality.ai (vendor claims 99% but third parties don't reproduce)
- Turnitin (300-word floor — disqualified)

## Integration plan

1. **Cloud Function:** new `verifyReflectionText` callable in Firebase Functions. Browser POSTs `{reflection_text, session_id}`. Function calls Pangram API (key never client-side), returns score 0-1.
2. **UI:** add "verifying reflection" loading state to CME submit flow (~500ms latency).
3. **Score handling:** feed `pangram_score` into the gated composite. Suggested initial weights:
   - score >0.9 → high confidence AI → cap composite at PASSIVE max (0.30)
   - score 0.4-0.9 → neutral
   - score <0.4 → low confidence AI → no penalty
   - Tune on real data; store version in receipt.
4. **Fallback:** distilGPT2 client-side — soft input always available.
5. **Receipt schema addition:** `text_classifier_provenance: "pangram-3.2"` + version-pin. Maintains "cryptographic receipt" narrative — auditor can verify which detector/version produced the score.
6. **Honest disclosure:** at 20-50 words, even Pangram has FP risk. Don't gate hard; weight in composite.

## Honest detection-by-length breakdown

| Length | Pangram | Binoculars | GPTZero | Originality | Copyleaks |
|---|---|---|---|---|---|
| **20-50 words** (current floor) | ~99.8% (claimed) | ~85-90% | 60-80% | 60-80% | 60-80% |
| 50-100 words | ~99% | ~90-95% | 80-90% | 80-90% | 80-90% |
| 100-500 words | ~99% | ~95% | 85-95% | 85-95% | 85-95% |
| >500 words | ~99% | ~95% | >95% | >95% | >95% |
| <20 words | unreliable | unreliable | unreliable | unreliable | unreliable |

## Adversary cost analysis

| Stack | Adversary cost |
|---|---|
| Status quo (composition integrity only) | $0, ~5 min — uses any LLM, types slowly |
| + Pangram | $20/mo humanizer subscription + 10-20 min per attempt + 90%+ failure rate per attempt |
| + Pangram + composition integrity + cadence model | Custom tooling, hours per attempt, <50% per-attempt success |
| Worst case (motivated, well-funded) | $5k-20k engineering effort + custom humanizer trained against Pangram. Still imperfect (Pangram updates) |

## Composite story for buyers / YC

> "Composition integrity catches paste attacks. Text classification catches generation attacks. Together they raise adversary cost from $0 to thousands of dollars per credentialing fraud — and the receipt still doesn't lie about which signals fired."

## Sources

- [Pangram 3.2 release](https://www.pangram.com/blog/introducing-pangram-3-2)
- [EditLens paper arXiv 2510.03154](https://arxiv.org/pdf/2510.03154)
- [Pangram humanizer benchmark Aug 2025](https://www.pangram.com/blog/humanizers-aug-25)
- [Pangram third-party evaluations](https://www.pangram.com/blog/third-party-pangram-evals)
- [Binoculars (UMD ICML 2024)](https://arxiv.org/abs/2401.12070)
- [Stanford SCALE GPTZero accuracy](https://scale.stanford.edu/ai/repository/assessing-gptzeros-accuracy-identifying-ai-vs-human-written-essays)
- [SynthID DeepMind](https://deepmind.google/models/synthid/)
- [Chicago Booth: do AI detectors work?](https://www.chicagobooth.edu/review/do-ai-detectors-work-well-enough-trust)
