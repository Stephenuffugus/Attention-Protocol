# Resume after baseball

Everything is committed and pushed. Code is safe.

---

## What just happened — the wall is LIVE

You deployed THE WALL to production. All three Cloud Functions are
running on `sws-attention-proofs`:

- **signReceipt** — issues signed JWT receipts
- **publicKey** — serves the JWKS endpoint
- **onSessionWritten** — server-side recompute (the wall itself)

Plus secrets: `SWS_DID_SALT`, `SWS_SIGNING_KEY`, `SWS_SIGNING_KID`
all uploaded to Google Secret Manager. Firestore rules + indexes +
TTL policy all deployed. Hosting redeployed with the Ed25519 polyfill
for old browsers (your 16-year-old Mac case).

You ran an end-to-end smoke test on `cme-demo.html` and got a real
signed receipt back. The wall correctly returned **MARGINAL** for
your distracted session — that's the wall *working*, not failing.
P(human) was 0.842 with bootstrap CI [0.784, 0.898] over the v2
calibration set (5 humans + 28 bots).

**This means: SWS Attention Protocol is now a live deployed product
end-to-end, not just code on a branch.**

---

## State of the repo

- Branch: `main`, clean, in sync with origin.
- Last commit: `47c2cbf` — YC draft tightening (founder video + pre-submit checklist).
- Test suite: 267/267 passing (last run before deploy).
- 7 hostile-review rounds closed, ~93 findings closed.

---

## What's next when you sit back down — pick one

### Option A — Tell people the wall is live (cheapest, highest leverage)

Now that the wall is live and you have a working signed receipt with
trust_tier signals, the OUTREACH play is much sharper than it was.
30-60 minutes of writing.

- `OUTREACH_PLAY.md` and `outreach-drafts/01-ppp.md` were drafted before
  the wall shipped. They can now say "live signed receipts at this URL."
- One paragraph swap is the work.

### Option B — Finish the YC application

YC submission deadline: **May 4, 2026 at 8:00pm PT**.

The 6 Stephen-only inputs are the gating items now (LLC state, accomplishment,
burn/runway, patent serial, project-start date framing, founder video).

`YC_S26_APPLICATION_DRAFT.md` has the full structured checklist at the bottom.

### Option C — Smoke test more carefully + write the post-deploy note

The session you ran was distracted (you said so). One more careful
session with engaged reading would produce a CREDIT-tier receipt
that you can screenshot for the YC application and outreach.

10 minutes of careful clicking.

---

## Capital reality, plainly

Same as before — YC application is the highest-yield-per-effort thing
this week. The wall going live materially strengthens it. You can
now say "live deployed product on Firebase Cloud Functions" not
"code-complete, awaiting deploy."

---

## When you sit back down

Open this file. Pick A, B, or C. Or type **"recommend"** and I'll
pick.

Until then — go enjoy baseball. Nothing breaks while you're away.
