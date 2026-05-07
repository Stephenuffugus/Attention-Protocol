# Competitive Landscape Cheat Sheet
**Phone-readable. Tap-to-find when a name comes up mid-call.**

These are the companies a prospect will name when they ask "how is this different from X?" Each entry has the honest answer + the bridge phrase.

---

## BioCatch (THE most likely name they'll drop)

**What they are:** Israeli behavioral fraud detection. ~2000 features. Best-in-class classifier for online banking fraud. Public, ~$200M+ revenue. Used by major US banks.

**What they do:** Real-time risk scoring for transactions. Output: a fraud score, often used to block or step-up authentication.

**How SWS is different:**

> *"BioCatch is best-in-class behavioral fraud detection. It's a classifier, not a receipt. It outputs a confidence score that lives in their dashboard. We ship a signed, layered, audit-grade receipt your auditor can verify offline six months from now without calling us. Different artifact, different buyer, different problem."*

**Bridge phrase:**

> *"Has your team ever evaluated BioCatch or anything in that lane? What killed it or kept it alive?"*

**Wrong answer:** "We're more accurate than BioCatch." (You're not. They have 10 years of data. Don't claim it.)

---

## Roundtable (YC W24)

**What they are:** Princeton cog-sci founders Mayank Agrawal and Matt Hardy. Behavioral-biometrics "Proof-of-Human" API. YC W24, raised seed. ~10-30 people.

**What they do:** Detect non-human respondents in surveys and forms. Output: a confidence score the panel/platform consumes internally.

**How SWS is different:**

> *"Roundtable is YC-backed proof-of-humanness, similar lane. They publish accuracy benchmarks (87% vs Cloudflare 33%). Their pitch is the classifier. Ours is the artifact. Roundtable solves the panel's problem (catching bots before scoring). SWS solves the panel's BUYER's problem (audit trail and downstream verification of who paid attention). Possible OEM/partnership: their detector + our receipt = full chain-of-custody."*

**Bridge phrase:**

> *"Have you looked at Roundtable? What was your read on the buyer side of their value prop?"*

**Notes:** They're peers, not enemies. If a prospect raises Roundtable, the move is collaborative framing.

---

## Imperium (RelevantID)

**What they are:** The incumbent panel-fraud detection vendor. M3 Global Research (the physician panel) stacks them with reCAPTCHA + photo-ID + facial recognition.

**What they do:** Survey-fraud detection at the panel layer. Output: a flag/score for the panel internal use.

**How SWS is different:**

> *"Imperium catches fraud at the panel-internal layer. We add a buyer-verifiable artifact for the same session. The panel still uses Imperium for their own quality screen; we layer the receipt the panel hands to the data-buyer. Complementary, not replacement."*

**Bridge phrase:**

> *"What % of your fraud detection currently lives at the panel level versus exposed to the data buyer?"*

---

## Worldcoin / Civic / Holonym (proof-of-personhood / civic identity)

**What they are:** A category of "prove you're human" identity systems. Worldcoin uses iris biometrics. Civic uses FaceTec liveness. Holonym uses ZK proofs of identity attributes. ~5-15 named players in the space.

**What they do:** Issue a one-time or refreshable "you are a unique human" credential. Output: a credential the user holds.

**How SWS is different:**

> *"Civic and Worldcoin prove WHO you are at sign-in, once. SWS proves THE HUMAN STAYED at the keyboard during the actual task. Different layer of the same problem. They handle gate-of-entry; we handle continuous attention attestation. We complement them rather than replace them."*

**Bridge phrase (only if Web3/civic-identity prospect):**

> *"Are you currently exploring any of those personhood vendors? How does the per-session proof-of-attention question come up in your design?"*

---

## Captchas (reCAPTCHA, hCaptcha, Cloudflare Turnstile)

**What they are:** The original anti-bot defense. Mostly broken now against modern AI agents.

**What they do:** Block presumed bots before they can act. Output: a click-through gate.

**How SWS is different:**

> *"reCAPTCHA's modern-AI-agent catch rate is around 33%. SWS doesn't try to gate; we measure attention during the actual task and produce the artifact. Different posture entirely."*

**Bridge phrase:**

> *"What fraction of your traffic still gets stopped by your current captcha layer?"*

---

## OpenBadges 3.0 / 1EdTech ecosystem (Credly, Accredible, Badgr, etc.)

**What they are:** Digital credential issuance platforms. Credly (Pearson-owned) is the biggest. Accredible launched OB 3.0 + W3C VC support Jan 2026. ~20+ players in the space.

**What they do:** Issue and verify digital credentials (badges, certificates). Output: a portable VC.

**How SWS is different:**

> *"Credly issues badges. SWS issues the EVIDENCE that the badge was earned by a real human. We slot into the OpenBadges 3.0 evidence field. We're a layer underneath the badge platform, not a competitor to it."*

**Bridge phrase (for credentialing prospects):**

> *"Are you currently filling the OB 3.0 evidence field? With what?"*

---

## Online Proctoring (Honorlock, Proctorio, Respondus, ProctorU/Meazure)

**What they are:** Webcam-based exam proctoring. Higher-ed and credential-exam standard.

**What they do:** Watch the test-taker via webcam, flag suspicious behavior. Output: a video record + classifier flags.

**How SWS is different:**

> *"Proctoring is about catching cheating in-session via webcam. SWS is about producing a signed integrity-of-completion receipt without webcam evidence. Different artifact, no PII trail. Privacy-litigated proctoring vendors are looking for exactly this complementary layer."*

**Bridge phrase (for proctoring prospects, channel-partner play):**

> *"Has your team thought about a no-webcam integrity artifact for the post-hoc audit / dispute path?"*

---

## "We could just build this ourselves"

The most-likely cope from a sophisticated buyer.

**Honest answer:**

> *"You could. The protocol part is open and re-implementable. What you'd be building is roughly 12-18 months of work, starting from cognitive-science papers, behavioral-signal calibration, key-rotation infra, public verifier UX, and 7 rounds of hostile review. The pieces I'd point you at as the moat are: the patent-pending receipt construction (filed March 2026), the calibrated behavioral signal weights, the trace-novelty fingerprint for replay-defense, and the integrated environmental + composition + honeypot layers all bound under one signature. Those 4 took most of the time."*

**Bridge phrase:**

> *"If your team had 12-18 months and a calibrated signal-weight set, is that a build-vs-buy you'd actually want to take?"*

The honest move: don't fight build-vs-buy. Concede that any large engineering team COULD build this; emphasize the time cost and the moat pieces. Sophisticated buyers will respect the honest framing.

---

## Where SWS uniquely sits

To frame proactively when "what makes you different" comes up:

> *"Three places nobody else sits at once:*
>
> *(1) Cryptographically-signed, publicly-verifiable. Six layers under one signature, verifiable offline against our JWK without calling us. That's a receipt, not a score.*
>
> *(2) Patent-filed and audit-defensible. Filed at USPTO March 2026; 21 CFR Part 11 clause-by-clause matrix shipped; honest TECH/MIXED/PROC labels.*
>
> *(3) No PII, no content, no URLs. The receipt is behavioral metrics + a signature. Privacy team's concerns vanish in the first 60 seconds.*
>
> *Everyone else picks one or two of those. We picked all three on purpose."*

That's a clean 30-second answer to "what makes you different."
