# Cognitive-Motor Invariants — YC Technical Defense Brief

Source: agent research synthesis 2026-04-26. Use this as the cheat sheet for "why does signal X catch a bot?" questions in a YC technical interview.

## Defense Pattern

Each signal is **(i) a closed-loop biological invariant** (not a learned behavior), **(ii) verifiable with a small statistic** (slope, exponent, PSD α, CV), **(iii) breaks under independent-sample bot models**. The composite power comes from joint failure: a bot can fake any *one* law with effort, but all six simultaneously requires modeling human motor control end-to-end — which collapses to "build a human."

---

## 1. Fitts' Law — pointing-time vs target geometry

- **Form (Shannon/MacKenzie 1992):** MT = a + b·log2(D/W + 1), where ID = log2(D/W+1) is index of difficulty in bits. Throughput TP = ID/MT (bits/s).
- **Why hard to fake:** Fitts emerges from closed-loop motor control — submovements, signal-dependent noise (Harris & Wolpert 1998), biomechanical inertia. Naive bot with uniform velocity = flat MT-vs-ID curve (slope b ≈ 0). Faking requires (i) measure D and W per target, (ii) pick MT consistent with user's a/b, (iii) inject endpoint scatter consistent with effective width W_e ≈ 4.133·SD_x (ISO 9241-411). Throughput TP is invariant across ID for humans (Wobbrock 2008) — bots that don't model SDNM noise break this invariance.
- **Documented spoofing:** BeCAPTCHA-Mouse (Acien 2022) generates GAN trajectories that fit Fitts — but only by training on real human data. Function-based heuristic bots fail at 93% detection.
- **Typical values:** b ≈ 100–200 ms/bit; a ≈ 0–200 ms; R² typically 0.90–0.97 (Wobbrock 2008: R² = 0.959 across 90 conditions).
- **Cite:** MacKenzie, I. S. (1992). Fitts' law as a research and design tool in HCI. *Human-Computer Interaction*, 7(1), 91–139.

## 2. Hick-Hyman Law — choice reaction time

- **Form:** RT = a + b·log2(n + 1), generalized RT = a + b·H (Shannon entropy of stimulus set).
- **Why hard to fake:** The +1 form arises from optimal Bayesian decision under uncertainty — a property of *information accumulation*, not lookup. Bots with constant RT or RT ∝ n deviate. Slope b is task-stable per user (~150 ms/bit) and survives stimulus-probability manipulations (RT scales with -Σ p·log2 p, not n alone). Faking requires modeling per-stimulus probability, not just count.
- **Documented spoofing:** No documented bot specifically targets Hick — most fail trivially because they don't react to stimulus count.
- **Typical values:** a ≈ 200 ms, b ≈ 150 ms/bit; R² > 0.95 in clean lab data.
- **Cite:** Proctor, R. W., & Schneider, D. W. (2018). Hick's law for choice reaction time: A review. *Quarterly Journal of Experimental Psychology*, 71(6), 1281–1299.

## 3. Two-Thirds Power Law — velocity/curvature coupling

- **Form:** V = K·C^(-1/3), or angular speed ω = K·κ^(2/3) where κ is path curvature, K is piecewise-constant velocity gain.
- **Why hard to fake:** Kinematic constraint of the human motor cortex — minimum-jerk trajectories naturally produce β ≈ 1/3 (Viviani & Flash 1995). Linear-interpolation bots: V constant regardless of C, exponent ≈ 0. Bezier-curve bots: match path geometry but get β wrong (often 0 or 1/2). Even GAN-generated trajectories show characteristic β deviation outside human 0.30–0.36. Crucially, the law holds *segment-wise* with K shifting at inflection points — extremely hard to fake without explicit segment detection.
- **Documented spoofing:** BeCAPTCHA-Mouse explicitly models 2/3 power law in its synthesis layer; without it, function-based bots fail. Atypical populations (autism — Cook et al. 2026 *Sci Rep*) show exponent shifts — proves the signal is biologically grounded.
- **Typical values:** β = 0.33 ± 0.03 in adult humans; R² 0.85–0.95 per movement segment.
- **Cite:** Lacquaniti, F., Terzuolo, C., & Viviani, P. (1983). The law relating the kinematic and figural aspects of drawing movements. *Acta Psychologica*, 54(1–3), 115–130.

## 4. 1/f (pink) Noise in Attention Sequences

- **Form:** Power spectral density S(f) ∝ 1/f^α, α ≈ 1.0 for human RT/error sequences. Equivalently, DFA scaling exponent H ≈ 0.7–0.9.
- **Why hard to fake:** 1/f arises from long-range temporal correlations — coupling across multiple timescales. i.i.d. Gaussian/uniform jitter → white noise (α = 0). Single AR(1) → brown noise (α = 2) at low frequencies. Faking α ≈ 1 requires (i) explicit fractional Gaussian noise generation, or (ii) running an actual multi-timescale process. Most bot RT distributions fail trivially.
- **Documented spoofing:** No mainstream bot framework generates 1/f-distributed inter-event times. **One of the strongest unfaked signals in the wild.**
- **Pre-empt Wagenmakers 2004:** Many published 1/f results are SRD artifacts. Use ARFIMA + AIC model selection in our α-estimator, not naive log-log slope.
- **Typical values:** α = 0.8–1.2 for humans across 500–1000 trial sequences; bots/random ≈ 0.0; need ~256 trials minimum for reliable PSD slope.
- **Cite:** Gilden, D. L., Thornton, T., & Mallon, M. W. (1995). 1/f noise in human cognition. *Science*, 267(5205), 1837–1839.

## 5. Saccade-Fixation Reading Rhythm

- **Form:** Quantified rhythm — fixation durations 200–250 ms (mean 225 ms English), saccade amplitudes 7–9 character spaces, ~10–15% regression rate, ~50 ms saccade duration. Reading rate 200–400 wpm.
- **Why hard to fake:** Requires synchronized eye-tracking telemetry (WebGazer, MediaPipe FaceMesh) PLUS content-aware fixation placement — fixations land on word centers (preferred viewing position), not random points. Bots either (i) skip eye telemetry (signal absent), (ii) generate uniform sweeps (no word-center bias, no fixation distribution), or (iii) replay recorded patterns (detectable via session entropy). Word-frequency effect (rare words → longer fixations) requires NLP on rendered text.
- **Documented spoofing:** No documented eye-pattern spoofers in production. DeepFake face-puppet attacks target identity, not reading micro-patterns.
- **Typical values:** Fixation duration mean 225 ms, SD 80 ms; saccade amplitude 7–9 letters; R² for reading-rate-vs-difficulty regression ≈ 0.7–0.8.
- **Cite:** Rayner, K. (1998). Eye movements in reading and information processing: 20 years of research. *Psychological Bulletin*, 124(3), 372–422.

## 6. Log-normal / ex-Gaussian RT Distribution

- **Form:** RT ~ ex-Gaussian(μ, σ, τ), or log(RT) ~ Normal. Wagenmakers-Brown law: SD(RT) = k·mean(RT) (linear), CV ≈ 0.15–0.30 simple RT, 0.20–0.40 choice RT, up to ~0.5 in attention-demanding tasks.
- **Why hard to fake:** Three signatures must co-occur: (i) right skew (τ > 0, exponential tail), (ii) linear mean-SD scaling (Wagenmakers & Brown 2007), (iii) CV in human range. Normal jitter → CV doesn't scale with μ. Fixed delay → CV ≈ 0. Uniform → fails skew. The diffusion-model interpretation (Ratcliff) makes ex-Gaussian a *consequence* of bounded evidence accumulation, not a chosen distribution.
- **Documented spoofing:** Some advanced bots sample from recorded human RT distributions — defeats marginal distribution test but typically fails (1) right skew and (5) saccade rhythm above.
- **Typical values:** CV 0.15–0.50 for healthy adults (higher = ADHD/fatigue/intoxication); τ/μ ratio 0.15–0.40; mean-SD correlation r ≈ 0.92 (Wagenmakers & Brown 2007).
- **Cite:** Wagenmakers, E.-J., & Brown, S. (2007). On the linear relation between the mean and the standard deviation of a response time distribution. *Psychological Review*, 114(3), 830–841.
