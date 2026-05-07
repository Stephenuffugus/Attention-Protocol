# PPP Call Glossary — Plain English

Every term that shows up in the cheat sheet and study packet, defined in one sentence and tied to your specific situation.

**The honest move if Jane uses a term you don't know:** *"Sorry, in my head that abbreviation maps to two things — what specifically is your auditor / compliance team asking about?"* That's not weakness, it's discovery. Solo founder + cross-domain product = nobody knows every acronym in every lane.

---

## Jane's vocabulary — CME / regulatory

| Term | What it means | Why it matters to your call |
|---|---|---|
| **ACCME** | Accreditation Council for Continuing Medical Education. The body that accredits MECs (medical education companies) like PPP to award CME credit. | Lose ACCME accreditation = the business stops. Jane's #1 fear. |
| **ABPN** | American Board of Psychiatry and Neurology. The board that certifies and re-certifies psychiatrists. | PPP's audience is ABPN-MOC physicians earning credits to keep their certification. |
| **MOC** | Maintenance of Certification. The ongoing recertification cycle ABPN runs — physicians must earn credits/exams every few years to stay board-certified. | The reason ABPN-MOC physicians do CME at all. |
| **IME** | Independent Medical Education. Pharma-funded but accreditation-firewalled educational activities. Pfizer pays for it, but ACCME-rules say PPP designs the content independently. | This is PPP's main revenue. Otsuka, AbbVie, Janssen are the grantors. | 
| **MEC** | Medical Education Company. Companies like PPP, Medscape, Prova, DKBmed that produce accredited CME content. | You're talking to one. |
| **Grantor** | A pharma company funding an IME activity (Otsuka, AbbVie, Pfizer, Lundbeck, etc.). | Their RFPs are what set "measurement of learner progression" expectations. |
| **Accredited activity** | A specific CME course/module/journal-article that PPP got ACCME-blessed and that physicians earn credits for. | Your pilot would attach to one of these. |
| **Post-test** | The quiz at the end of a CME activity. Passing = credit awarded. | "AI-assisted post-test completion" = physicians using ChatGPT to pass without engaging. The new fear. |
| **Click-through completion** | Fake completion: just clicking "next" through the activity without reading. The old fraud. | Your protocol catches this trivially. |
| **JCP** | *Journal of Clinical Psychiatry* — PPP's flagship publication. | If she's proud of anything, it's JCP. |
| **PCC** | *Primary Care Companion for CNS Disorders* — PPP's other journal. | Less central; mention only if she does. |
| **21 CFR Part 11** | FDA regulation on electronic records and electronic signatures used in regulated industries. Defines what makes an e-signature legally binding. | You have a clause-by-clause matrix in your repo. Offer it if compliance comes up. |

---

## Procurement / business vocabulary (what their compliance team will ask about)

| Term | What it means | Honest answer for you |
|---|---|---|
| **SOC 2** | Service Organization Control 2. A standard audit (Type 1 = point-in-time, Type 2 = over-time) of a vendor's security controls. ~$25–60k and 6+ months to get. | *"I'm pre-SOC-2; I'm a solo founder, this is customer-development. I'd start the SOC 2 process when we have a paying contract that requires it. For a free pilot I can give you the SIG Lite security questionnaire pre-fill instead."* |
| **DPIA** | Data Protection Impact Assessment. A structured doc explaining what personal data your system processes and the risk to data subjects. EU/GDPR concept; US procurement asks for it too. | Your DPIA writes itself: zero PII, zero content, zero URLs. Behavioral metrics + a signature, that's it. Easiest DPIA in the world. |
| **Sub-processor** | A vendor your vendor uses (e.g., your hosting provider). Buyers want a list because data flows through all of them. | Yours: Google Firebase (Functions, Firestore, Hosting). One sub-processor, one location, easy to disclose. |
| **Vendor review** | Their procurement team's checklist before approving a new vendor: SOC 2, DPIA, sub-processors, insurance, etc. | At a small MEC like PPP this is lightweight; at Pfizer it's 3–6 months. |
| **Entity** | Short for *legal entity* — your LLC. "Are you incorporated?" | Yours is *SWS Strategic Media LLC* — already exists, already in the patent filing and email signature. |
| **Runway** | Months of cash you can survive on before going broke. Investor / partner question to assess if you'll still exist in 12 months. | If asked, the honest answer: *"I'm bootstrapping personally; YC S26 outcome and a paid pilot are what extend runway. I'm not betting their pilot on me running out of money."* |
| **Free pilot** | A 60-day trial you give them at no cost in exchange for a co-authored case study. | Standard for early-stage SaaS. Lets Jane try without going through procurement for budget. |
| **LOI** | Letter of Intent. Non-binding written commitment that they're interested in piloting / paying. Useful for YC and for cofounder conversations. | Optional ask at end of call if she's warm. Don't lead with it. |

---

## Your vocabulary — the crypto / technical primitives

These are the words to **say with confidence**, even if Jane doesn't know them. Naming primitives concretely is what makes the protocol sound real instead of marketing-air.

| Term | What it means (one sentence) |
|---|---|
| **JWT** | JSON Web Token. A small text blob with three parts: claims (the data), a signature (proves authenticity), and a header. Standard, used by Google, Auth0, basically everyone. |
| **Signature** | A cryptographic stamp produced by your private key that anyone with your public key can verify. Like a wax seal except the math means it can't be forged. |
| **Ed25519** | A specific signature algorithm — fast, small, modern. The same algorithm Apple, Cloudflare, and SSH use. Not exotic. |
| **JWK / JWKS** | JSON Web Key / JSON Web Key Set. The format for publishing your public key on the web so anyone can verify your signatures. Plural is "JWKS" — the file at a stable URL listing your current public keys. |
| **Public key / private key** | Two halves of a key pair. You hold the private key (used to sign). The world has the public key (used to verify). Knowing the public key tells nobody anything about the private key. |
| **OpenTimestamps** | A free open-source protocol that anchors a hash to the Bitcoin blockchain — proves a piece of data existed before a specific point in time. Decentralized timestamping. |
| **Bitcoin-anchored** | The fact that you used OpenTimestamps to write a hash of the receipt into Bitcoin's transaction history. Means the timestamp can't be backdated by you, by Jane, or by anyone. |
| **Offline verify** | The auditor checks the receipt against the public key without calling your server. The math is independent of your infrastructure. |
| **SDK** | Software Development Kit. The piece of code Jane's team would paste into the activity page (one `<script>` tag). |
| **Browser-side / client-side** | Code that runs in the learner's browser, not on PPP's server. Means the behavioral signals are computed on the learner's device. |
| **PII** | Personally Identifiable Information. Names, emails, IP addresses, anything that can identify a specific person. **You collect zero PII.** Repeat that line often. |

---

## Competitive landscape (so she doesn't blindside you)

| Term | What it is | Your one-sentence response |
|---|---|---|
| **BioCatch** | Israeli company. Behavioral biometrics for fraud detection, mostly for banks. ~$200M revenue. | *"BioCatch ships a score, not a signed audit artifact. ACCME doesn't accept a vendor score; they want evidence."* |
| **Roundtable** | Y Combinator W26 startup. Proof-of-humanness scoring API. Closer to your lane. | *"Roundtable also ships a score. Same gap — no cryptographic, offline-verifiable receipt your auditor can hold up under audit."* |
| **YC / Y Combinator** | Famous startup accelerator (Airbnb, Stripe, Dropbox came out of it). | You're an applicant for **Summer 2026 (S26)**, decision window June–mid-July. Roundtable is **W26** — Winter 2026 batch — meaning they're a few months ahead of you in the YC cycle. |
| **W26 / S26** | YC batch codes. Winter 2026 (W) = Jan-Mar batch. Summer 2026 (S) = Jun-Aug batch. | If she asks "what batch" — S26 application stage. |

---

## Your stack words (in case she pokes at the build)

| Term | What it means | Honest line |
|---|---|---|
| **Patent / provisional patent** | Provisional = an early, cheap (~$65) patent filing that locks in your priority date for 12 months. Then you decide whether to convert to a full filing. | Yours: USPTO **SWS-PROV-001**, filed **2026-03-17**. |
| **Attestation** | A formal statement, usually cryptographically signed, that something is true. Your receipt is an attestation that "a real human paid attention." | Use this word when she's in compliance-speak. |
| **Subpoena** | A legal order forcing a vendor to produce records. The reason auditors hate vendor-dependent verification: if the vendor disappears or won't respond, the audit trail breaks. | Your offline-verify story sidesteps this entirely. |
| **QA** | Quality Assurance. Her team's checking process before an activity ships. | Question 6 asks about her QA flow. |
| **Composite score** | A single number combining all 23 behavioral signals into one human-confidence value. | What gets stamped onto the JWT. |
| **The protocol** | What you call the whole stack: SDK + signing function + JWKS + verifier. Don't say "the platform" — too SaaS-bro. **The protocol** sounds engineered. | Use this word. |
| **Composition integrity** | Your internal term for "the receipt's parts agree with each other." Detects bots that fake one signal but contradict themselves on another. | Don't volunteer this term unless she asks something deep. |

---

## If you don't know a term — three honest moves

1. *"Sorry, in my head that abbreviation maps to two things — what specifically is your team asking about?"* (turns confusion into discovery)
2. *"I haven't dug deep on that one — give me the shape of the question and I'll tell you what I actually know."*
3. *"That's outside what I've built so far. If it matters for a pilot I'll come back with a real answer."*

**What you never do:** bluff. The moment you fake an answer she'll know, and the call's over. Your edge is honesty + the math; don't trade either away.
