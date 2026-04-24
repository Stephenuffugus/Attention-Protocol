# SWS Attention Protocol — Letter of Intent Template
## One-page, non-binding LOI for "yes-but-procurement-slow" buyers

**Who this is for:** Stephen. Use this when a buyer has said *"we want to move forward, but procurement/legal will take 3–6 months"* — which is almost every Fortune 500 conversation. An LOI parks the commercial intent in writing while the long cycle runs in the background, keeps momentum, and gives you something concrete to reference in the YC application, investor conversations, and the next prospect's call.

**What an LOI is (and isn't):**
- **Is:** A one-page mutually-signed document stating that both parties intend in good faith to proceed to a pilot MSA on a specified scope, timeline, and commercial shape. Typically non-binding except for confidentiality and the exclusivity / no-shop clause if either side requests one.
- **Isn't:** A contract, a purchase order, a commitment to pay, or a substitute for the pilot MSA. Do not invoice against an LOI. Do not claim revenue against an LOI.

**How to use it:**
1. Buyer signals real intent but procurement/legal is the blocker.
2. You offer the LOI as the interim step.
3. Both sides sign within 5 business days.
4. The LOI date becomes your "first LOI signed" asset for YC, investors, and the next prospect call.
5. Pilot MSA negotiation runs in parallel on its own timeline.

**Legal note:** This template is not legal advice. Before first use, have it reviewed by counsel. Once reviewed, it can be re-used without re-review unless you change substantive terms. Your LLC (SWS Strategic Media LLC) must be formally incorporated before the LOI is binding on your side — the advisor flagged entity formalization as a load-bearing gap.

**Freeze rule:** Standard. Updates stage in `loi-template.next.md`.

**Last updated:** 2026-04-24.

---

## Table of contents

1. The template (paste into Google Docs / Word / DocuSign)
2. Per-vertical insertion notes (what goes in the brackets)
3. When to use it — and when not to
4. Clauses to add only if the buyer asks
5. Red flags — when a buyer's LOI response means "no"

---

## 1. The template

```
LETTER OF INTENT
SWS Strategic Media LLC × [BUYER LEGAL NAME]

Date: [YYYY-MM-DD]

1. Parties. This Letter of Intent ("LOI") is between SWS Strategic
   Media LLC, a [STATE]-registered limited liability company
   ("SWS"), and [BUYER LEGAL NAME], a [JURISDICTION]
   [ENTITY TYPE] ("Buyer"), collectively the "Parties."

2. Purpose. The Parties intend in good faith to negotiate and execute
   a pilot Master Services Agreement ("Pilot MSA") under which SWS
   will deploy its Attention Protocol receipt-issuance SDK within
   Buyer's [MODULE / ACTIVITY / PLATFORM FEATURE], to produce
   cryptographically-signed, independently-verifiable attestation
   receipts for a named pilot cohort.

3. Proposed pilot scope. Subject to execution of the Pilot MSA:
   (a) Named scope: [ONE NAMED MODULE / ACTIVITY / CREDENTIAL TYPE].
   (b) Pilot duration: 60 calendar days from the first live receipt
       issued.
   (c) Pilot population: up to [N] [SEATS / SESSIONS / CREDENTIALS].
   (d) Integration: SWS-provided JavaScript SDK deployed via a single
       script tag. No backend systems deployed into Buyer's
       environment during pilot.
   (e) Receipts generated are retained by Buyer for the full
       [COMPLIANCE RETENTION WINDOW, e.g., 7 years for 21 CFR Part 11].
   (f) Independent verification: all receipts verifiable offline by
       Buyer against SWS's published JSON Web Key Set
       (https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json).

4. Proposed commercial shape. Subject to execution of the Pilot MSA:
   (a) Pilot fee: [AMOUNT — see docs/pricing.md §2], payable upon
       execution of the Pilot MSA or waived in exchange for a
       co-authored case study.
   (b) Post-pilot production pricing: per [PER-CREDENTIAL /
       PER-SEAT-MONTH / PLATFORM FLAT] basis as specified in the
       Pilot MSA. Indicative ranges set out in SWS's pricing
       framework and disclosed to Buyer.

5. Target timeline.
   (a) Pilot MSA execution: within [45 / 60 / 90] days of LOI
       signature, subject to the Parties' internal review cycles.
   (b) Pilot kickoff: within 15 business days of Pilot MSA
       execution.

6. Privacy and data handling. The SWS SDK is architected to emit
   receipts containing only behavioral composite signals,
   environmental signals, composition-integrity signals,
   honeypot canary state, consent attestation, signature metadata,
   and timestamp anchors. No personally identifying information
   (including names, email addresses, phone numbers), no learner-
   session content, and no URL strings leave Buyer's environment
   through the SWS pipeline during pilot. GDPR Article 7 / CCPA
   §1798.120-aligned consent attestation is encoded within each
   receipt.

7. Confidentiality. Each Party will treat the other's proprietary
   and commercial information disclosed in connection with this LOI
   as confidential and will not disclose it to third parties
   without written consent, except as required by law or to
   professional advisors bound by equivalent confidentiality
   obligations. This clause survives termination of this LOI for
   two (2) years.

8. Non-binding. Except for Section 7 (Confidentiality) and
   Section 9 (Governing law), this LOI is non-binding, is an
   expression of intent only, and creates no legal obligation on
   either Party. Either Party may terminate this LOI at any time,
   for any reason, by written notice to the other Party.

9. Governing law. This LOI is governed by the laws of
   [STATE — default Delaware if SWS is Delaware LLC], without
   regard to conflict-of-laws principles.

10. Expiry. This LOI expires on the earlier of (a) execution of the
    Pilot MSA, (b) [DATE — default 120 days from signature], or
    (c) written notice of termination from either Party.

Signed:

____________________________       ____________________________
For SWS Strategic Media LLC        For [BUYER LEGAL NAME]
Name: Stephen Furpahs               Name: [SIGNATORY NAME]
Title: Managing Member              Title: [SIGNATORY TITLE]
Date: ______________                Date: ______________
```

---

## 2. Per-vertical insertion notes

### Pharma / regulated enterprise (Pfizer, Merck, Novartis, etc.)

- **Named scope:** one GxP training module, e.g. *"SOP: Clinical Trial Data Integrity Refresher v4."* Do not scope a category; scope a specific named deliverable.
- **Pilot population:** 200–500 seats is typical Director-discretionary.
- **Compliance retention window:** 7 years (21 CFR Part 11). Make this explicit.
- **Pilot fee:** $5,000–$25,000 per the pricing doc (`docs/pricing.md` §2). Do not waive the pilot fee for regulated-enterprise buyers unless there's a strategic logo reason.
- **Timeline:** 90 days to MSA. Regulated-enterprise procurement is slow.
- **Privacy section matters here.** Make sure the privacy paragraph in §6 is accurate to your SDK's real behavior. Do not overclaim.

### MEC / CME publisher (Medscape, DKBmed, etc.)

- **Named scope:** one accredited activity by name, e.g. *"Anticoagulation Management in the Outpatient Setting — Winter 2026 Cohort."*
- **Pilot population:** 500–5,000 physician sessions is typical.
- **Compliance retention window:** standard ACCME retention, 6 years.
- **Pilot fee:** $0–$5,000. For MECs, the joint case study is usually better leverage than the pilot fee; waive the fee to get the case study.
- **Timeline:** 45–60 days to MSA. MECs move faster than pharma.

### Platform (PlatformQ Health, EthosCE, Cadmium)

- **Named scope:** one platform integration feature, not one activity. For example, *"SWS receipt issuance as a platform-level feature available to PlatformQ's MEC clients on their accredited activities."*
- **Pilot population:** uncapped; typically measured in activities rather than seats.
- **Pilot fee:** $0–$10,000. Co-marketing rights are the real consideration.
- **Timeline:** 60 days to MSA for the technical partnership layer; Pearson-level commercial terms (if Credly) are Step 3 and should not be blocking LOI execution.

### Credentialing (Credly, Accredible)

- **Named scope:** one credential type or one enterprise customer's credential catalog. Not the whole platform.
- **Pilot population:** 100–500 issued credentials.
- **Pilot fee:** $0 preferred; partnership terms are the real consideration.
- **Timeline:** 45–75 days to MSA. Pearson-level terms are later.

---

## 3. When to use it — and when not to

### Use an LOI when:

- The buyer says *"we're interested, but procurement / legal will take 3–6 months."*
- The buyer asks if SWS is *"vendor-approved"* at their organization — an LOI is a concrete step toward that.
- You need a named reference to cite in the YC application, investor materials, or the next prospect call.
- You want to slow procurement down to something that isn't "maybe next quarter."
- The buyer needs to go to an internal stakeholder — their boss, their legal team, their security team — with something in writing.

### Do not use an LOI when:

- The buyer hasn't yet agreed on pilot scope, population, or timeline. An LOI without named scope is a wish list, not a document.
- You haven't yet had a technical scoping call. Promising integration before you know what the buyer's stack looks like is how pilots miss criterion 4 (`docs/pilot-success-criteria.md`).
- The buyer is using an LOI to stall — see §5 (red flags).
- Your LLC is not yet formally incorporated. An LOI signed by a non-existent entity is unenforceable and embarrassing. Formalize the entity first.

---

## 4. Clauses to add only if the buyer asks

Do not add these proactively. Each makes the LOI harder to sign quickly.

- **Exclusivity / no-shop.** Buyer agrees not to engage with a competing attestation vendor during the LOI period. Only add if the buyer is a platform-tier deal (PlatformQ, Credly) where the partnership is strategic.
- **Pre-MSA technical access.** Buyer gains access to the SWS SDK and evidence kit during the LOI period before MSA execution. Fine to grant — the evidence kit is already public.
- **Mutual NDA.** Redundant with §7 but some legal teams want a free-standing NDA. Reference the existing §7 or staple a mutual NDA to the LOI as Annex A.
- **Named individual contacts.** Some procurement teams want a list of named individuals on each side. Fine to add as Annex B.

---

## 5. Red flags — when a buyer's LOI response means "no"

Not every LOI conversation ends in a signature. Some signs that a buyer is using the LOI ask to slow-walk you toward a soft "no":

- **They want to strip §2 (the purpose statement).** §2 is the whole point. If they remove it, they do not intend to proceed.
- **They want to make everything non-binding including confidentiality.** Confidentiality is the one thing that should always be binding. If they push back, ask why.
- **They want the LOI to cover multiple unspecified pilot scopes.** An LOI without a named scope is a press release.
- **The timeline keeps moving.** If each draft round pushes the pilot-MSA execution target further out, the LOI is a delay device, not a commitment.
- **They refuse to name a signatory.** Unsigned LOIs are worth less than signed cold emails.

If you see these red flags, do not chase the LOI. Close the conversation politely, note the outcome, and move on. The next buyer is more productive than the current one.

---

**End of loi-template.** Before first real use: have counsel review. Once reviewed, add "reviewed by [LAWYER NAME] on [DATE]" to the top of this doc.
