# How to share the protocol with technical reviewers

**The artifact:** [https://sws-attention-proofs.web.app/for-reviewers.html](https://sws-attention-proofs.web.app/for-reviewers.html)

That URL is self-contained. Anyone who clicks it gets the curated reading order, the three highest-leverage pushback questions, and the disclosures-up-front so they can probe what matters. **No personalization required, no DM body to draft, no name to fill in.** Send the URL freely to anyone — multiple reviewers, group chats, comment on someone's post, drop in a forum.

---

## 1. The 30-second send

Most cases, the right message is just the URL with one line of context:

> sending you this for an honest read — I'd value pushback before YC submission. https://sws-attention-proofs.web.app/for-reviewers.html

That's it. The page does the work. The recipient lands on a self-contained reviewer entry point, knows what's being asked of them (critique, not validation), sees the reading order ranked by depth, gets the three highest-leverage questions front and center.

---

## 2. If a reviewer needs more context

If you want to elaborate beyond "honest read", these are the lines to consider:

- "Patent filed March 17. Live at the URL. I have 7 days before YC submission." (says: this is a real artifact under a real deadline)
- "The structural limit I hit on motor signals is disclosed openly — that's the kind of critique I want more of, not less." (signals: I'm not asking for endorsement, I'm asking you to find more)
- "Send pushback to stephenfurpahs@gmail.com or open a GitHub issue." (gives them the channel; the for-reviewers page also has both)

Use any combination, in your own voice. The page itself frames the rest.

---

## 3. Pre-flight checks (run if it's been a while since you deployed)

Confirm the deployed page actually serves the latest code before sending the URL widely:

```bash
# 1. The for-reviewers page itself
curl -s -o /dev/null -w "%{http_code}\n" https://sws-attention-proofs.web.app/for-reviewers.html
# Expected: 200

# 2. The cme-demo (which the reviewer page links to as item #2 in the reading list)
curl -s -o /dev/null -w "%{http_code}\n" https://sws-attention-proofs.web.app/cme-demo.html
# Expected: 200

# 3. The receipt-explorer (item #3 in the reading list)
curl -s https://sws-attention-proofs.web.app/receipt-explorer.html | grep -c "23 behavioral"
# Expected: 1

# 4. The deployed env-gate has the v2 stealth_tells string (sanity check that the deploy ran)
curl -s https://sws-attention-proofs.web.app/sdk/environmental-gate.js | grep -c "stealth_tells_v2"
# Expected: 1
```

If all four return their expected values, the deploy is healthy and the URL is safe to share.

---

## 4. After feedback comes in

The for-reviewers page asks reviewers to email or open a GitHub issue. Triage incoming feedback:

- **Real flaw that contradicts a YC application claim:** fix before submission, or soften the claim in the application. Don't ship a claim a reviewer just disproved.
- **Disclosure push:** good — that's the calibration-Bayesian-style critique. Add to `docs/yc-defense/11_calibration_methodology.md` §6 (known limitations) or §7 (anticipated questions).
- **Benchmark request:** triage by tractability. <1 day → run before submission. >1 week → queue for v2, disclose in the application.
- **Validation only / minor pushback:** the application is reviewer-defensible. Submit on time.

---

## 5. What NOT to do

- Don't share the YC application draft. That's tuned for YC partners, not external reviewers. Share the technical artifacts (the URL, the deep-dive, the calibration doc, the live demo).
- Don't ask for endorsement. The page asks for critique. If a reviewer wants to endorse, that's a bonus — it's not the goal.
- Don't apologize in advance. The page already does the right disclosure work; you don't need to soften the artifact before they see it.
- Don't share the URL before the deploy completes. The four pre-flight curls above are the gate.

---

**Bottom line:** the artifact is a URL. Send the URL. The page teaches.
