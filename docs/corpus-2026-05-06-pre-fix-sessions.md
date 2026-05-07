# Corpus 2026-05-06 — Pre-Fix Mobile Sessions

## Summary

Three real-user sessions were collected on 2026-05-06 against a demo bundle that contained a known false-positive bug in `composition-integrity.js` for mobile (touch-keyboard) users. The bug was fixed and deployed at 2026-05-06 ~15:57 UTC.

This document is the corrective annotation for those three sessions so any future reviewer (YC partner, buyer, or auditor) reading the `demos` Firestore collection sees the correct re-interpretation rather than just the legacy verdict.

## The bug, in one paragraph

iOS and Android virtual keyboards fire per-character `input` events at sub-60ms intervals when autocomplete inserts a word, and autocomplete eliminates the typo pressure that drives backspace ratio. Pre-fix, the composition-integrity scorer treated both signals as bot tells:

- ≥5% sub-60ms intervals → -0.15 score penalty
- ≥20% sub-60ms intervals → additional -0.15
- 0% backspace ratio on text ≥50 chars → -0.20 (`backspace_suspicious: true`)

A clean, careful older user typing a coherent reflection on an iPhone or Android phone with autocomplete enabled would routinely score 0.35 → verdict `suspicious`. Bot defense on mobile rests on environmental gate + paste-burst detection (both still active post-fix), not on digraph CV.

Fix shipped: when `device_class === 'mobile'` (detected via `matchMedia('(pointer: coarse)')` and confirmed by absence of `pointer: fine`), the digraph-CV, subhuman-ratio, and backspace-absence penalties are all suppressed. Paste-burst detection is preserved verbatim.

## The three pre-fix sessions

### `demo_1778080631253_m26vf3` — iPhone iOS 18.1, 15:24:49 UTC

| field | value |
|---|---|
| user_agent | iPhone OS 18_1 Safari/604.1 |
| duration | 458s (7m38s) |
| composite | 0.552 (active tier) |
| environmental.bot | false |
| typed_words | 22 |
| typed_text | *"It must be thorough and you're reading and it must be checked regularly once a month..."* |
| chars_typed | 237 |
| chars_deleted | 0 |
| digraph cv | 2.629 |
| subhuman intervals | 42 / 56 (75%) |
| **legacy verdict** | suspicious (0.35) |
| **corrective verdict** | **authored** — classic iPhone autocomplete pattern, otherwise clean session |

### `demo_1778081366216_pz9z3i` — Android 10, 15:41:10 UTC

| field | value |
|---|---|
| user_agent | Linux; Android 10; K |
| duration | 705s (11m45s) |
| composite | 0.589 (active tier) |
| environmental.bot | false |
| typed_words | 20 |
| typed_text | *"this policy covers attention tracking up to $2,000,000 by case and 5,000,000 by..."* |
| chars_typed | 141 |
| chars_deleted | 21 |
| digraph cv | 1.59 |
| subhuman intervals | 2 / 258 (0.8%) |
| **legacy verdict** | authored (0.85) |
| **corrective verdict** | **authored — unchanged.** This user used the keyboard's backspace and avoided the autocomplete-burst pattern. Verdict was correct pre-fix. **Salvageable as clean corpus data.** |

### `demo_1778082791574_v1gni3` — Android 10, 16:09:51 UTC

| field | value |
|---|---|
| user_agent | Linux; Android 10; K |
| duration | 974s (16m14s) |
| composite | 0.491 (passive tier, just below active) |
| environmental.bot | false |
| typed_words | 21 |
| typed_text | *"No im not doing this is insane I cant believe my friends are making me do this..."* (sarcastic protest) |
| chars_typed | 99 |
| chars_deleted | 0 |
| digraph cv | 1.77 |
| subhuman intervals | 57 / 253 (22.5%) |
| **legacy verdict** | suspicious (0.35) |
| **corrective verdict** | **authored** from a composition-integrity standpoint. **NOT recommended as clean-corpus data** because the typed reflection is sarcastic protest, not genuine engagement — that is a content-quality concern, not a fraud concern. Document this exclusion separately if used at all. |

## Net effect on the 2026-05-06 corpus

| device class | sessions | usable as clean corpus |
|---|---|---|
| iPhone (pre-fix bug) | 1 | 1 (after this annotation) |
| Android (pre-fix bug) | 2 | 1 (the engaged session; not the protest one) |
| iPhone (post-fix walkthrough harness, not real users) | 2 | 0 (test sessions, exclude) |
| **Total** | **5** | **2** |

## Process change going forward

Any user-facing change to demo.html or the 23-signal SDK now requires `node scripts/iphone-walkthrough.js` to return clean against the live URL before the change is considered ship-ready. This walkthrough drives WebKit (the same engine behind iOS Safari) at 375x667 viewport through all 5 phases, captures screenshots, verifies the receipt-saved status, and confirms `composition_integrity.device_class === 'mobile'` lands in the persisted session.

This was not in place on 2026-05-06 morning when corpus links went out. It is now.
