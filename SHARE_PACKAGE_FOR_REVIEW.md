# Share package for intellectual friend's review

**Use:** copy the message body below into a DM / email, paste your friend's name where indicated. Send after deploy completes.

---

## 1. The message (copy-paste-ready)

> Hey [name] —
>
> I'm submitting to YC S26 in a week and I'd love an intellectually-honest read from you before I do. The thing I'm building is a cryptographic-receipt protocol for human attention — a SHA-256-anchored, tamper-evident proof of what happened in a session, not a confidence score to trust. Patent filed March 17. Live at sws-attention-proofs.web.app.
>
> I'm not asking you to validate it. I want you to find what's wrong. The structural limit I hit on motor signals against curve-aware bots is disclosed openly in the deep dive — that's the kind of honest critique I want more of, not less. If you find others, that's the gold.
>
> Reading order if you want depth (skip any of these you don't have time for):
>
> 1. **README.md** in the repo — entry point. https://github.com/[your-repo]/blob/main/README.md
> 2. **Live demo, 5 minutes:** https://sws-attention-proofs.web.app/cme-demo.html — take the CME demo, get a real receipt, verify it. The "Verify This Receipt" button does the round-trip in one click.
> 3. **Receipt anatomy visualizer:** https://sws-attention-proofs.web.app/receipt-explorer.html — paste any receipt JSON, see every layer of evidence, every gate, the conformal Bayesian P(human) with bootstrap CI.
> 4. **The technical-reviewer document:** SEVEN_LAYER_DEEP_DIVE.md (in the repo). 580 lines. This is the one that walks through every layer with the real numbers, the structural limits, and what we chose under uncertainty.
> 5. **For a stats-trained read** of the conformal Bayesian: docs/yc-defense/11_calibration_methodology.md. Honest about N=5+10, the SD-floor 0.05 prior, the Gaussian-likelihood-ratio choice, the bootstrap CI limitations, and the v2 path.
> 6. **For the math defense** of the cross-signal coherence claim: docs/yc-defense/09_cross_signal_coherence_math.md. Sklar 1959 / Nandakumar 2008 TPAMI / Harris-Wolpert 1998 / Gilden 2001.
>
> The questions I'd most value your read on:
>
> - **Is the receipt-as-product framing actually distinct from "another bot detector"?** I think it is — the receipt is auditable offline, content-bound, signed, and survives even when bot detection fails. But I want a smart skeptic to push on it.
> - **Is the conformal Bayesian P(human) honestly disclosed?** The doc walks through what would and wouldn't survive a stats reviewer. Tell me what I missed.
> - **Is the structural single-signal motor limit (Bezier + 60Hz + Gaussian noise produces in-band stats) framed correctly as "the layered stack is the answer, not single-signal tightening"?**
>
> Anything else you want to push on, push. The 7-day window before I submit is the one chance I have to integrate hard feedback before YC partners see it. No social-niceties read; the harder the better.
>
> — Stephen

---

## 2. Pre-flight checks before sending (so the links work)

Before pasting the message, run these to confirm the deploy succeeded:

```bash
# 1. Confirm the deployed env-gate has the v2 stealth_tells string
curl -s https://sws-attention-proofs.web.app/sdk/environmental-gate.js | grep -c "stealth_tells_v2"
# Expected: 1

# 2. Confirm the deployed receipt-explorer has the "23 behavioral signals" header
curl -s https://sws-attention-proofs.web.app/receipt-explorer.html | grep -c "23 behavioral"
# Expected: 1

# 3. Confirm the deployed demo has the 23-signal subtitle
curl -s https://sws-attention-proofs.web.app/demo.html | grep -c "23 behavioral signals"
# Expected: 1

# 4. Sanity: confirm cme-demo loads
curl -s -o /dev/null -w "%{http_code}\n" https://sws-attention-proofs.web.app/cme-demo.html
# Expected: 200
```

If all four return the expected values, the deploy worked and the links in the message above point to the new version. Send the message.

---

## 3. After your friend replies — what to do with feedback

- **If they find a real flaw:** triage by severity. Anything that contradicts a YC-application claim gets fixed before submission (or the claim gets softened in the application).
- **If they push on a disclosure:** good — that's the conformal-Bayesian-style critique. The doc anticipates most of these; if they hit one we missed, add it to `docs/yc-defense/11_calibration_methodology.md` §6 (known limitations) and §7 (anticipated questions).
- **If they ask for a benchmark we haven't run:** triage. If it's tractable in <1 day, run it before submission. If it's >1 week of work, queue for v2 and disclose in the YC application.
- **If they validate or push only on minor details:** the YC application is reviewer-defensible. Submit on time.

---

## 4. What NOT to do

- Don't send before deploy completes. The `cme-demo.html` page they take will still be the old version.
- Don't ask for endorsement. Ask for critique. Endorsement is what YC partners give; critique is what your friend gives.
- Don't share the YC application draft. That's separate — it's tuned for YC partners, not for an external reviewer pre-submission. Share the technical artifacts (README, deep-dive, calibration doc, live demo).
- Don't apologize in advance for anything. The structural-limit disclosure already does the right work; you don't need to soften.

---

**Bottom line:** the artifact is ready, the disclosures are honest, the math is defensible, the live site shows real receipts on a tamper-evident pipeline. The 7-day window is for integrating real critique, not for second-guessing what's already shipped.
