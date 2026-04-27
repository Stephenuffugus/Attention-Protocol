#!/usr/bin/env node
/**
 * SWS Attention Protocol — Evidence Kit Generator
 *
 * Packages everything a prospective buyer or regulator needs to
 * self-qualify SWS in 10 minutes, into a single ZIP attachment:
 *
 *   evidence-kit/
 *     README.md                     — one-page orientation
 *     part-11-mapping.md            — clause-by-clause 21 CFR Part 11 walkthrough
 *     sample-signed-receipt.json    — real signed + stamped VC-JWT
 *     sample-xapi-statement.json    — the same receipt as an xAPI 1.0.3 statement
 *     sample-openbadge.json         — the same receipt as an OB 3.0 credential
 *     verify-instructions.md        — 4 ways to verify the signature offline
 *     public-key.jwk.json           — the public JWKS snapshot
 *     integration-snippet.html      — one-tag embed the buyer can paste
 *     patent-reference.txt          — patent filing reference
 *     behavioral-signals.md         — cite list for the 15 signals
 *
 * Usage:
 *   node scripts/generate-evidence-kit.js [--out=dist/evidence-kit.zip]
 *                                         [--receipt=proof/results/<bundle>.json]
 *
 * No extra dependencies required — uses the standard library's zlib
 * and a minimal ZIP writer (deflate + central directory).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function parseArgs(argv) {
  const args = { out: null, receipt: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--out=')) args.out = a.slice(6);
    else if (a.startsWith('--receipt=')) args.receipt = a.slice(10);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
      process.exit(0);
    }
  }
  return args;
}

// ============================================================
// Minimal ZIP writer (store + deflate) — no external dependency
// ============================================================

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function writeZip(entries, outPath) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const crc = crc32(raw);
    // Deflate (method 8) — better compression for text
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const method = useDeflate ? 8 : 0;
    const compressed = useDeflate ? deflated : raw;
    const time = 0, date = 0; // minimal; not needed for readers

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);       // local file header signature
    localHeader.writeUInt16LE(20, 4);               // version needed
    localHeader.writeUInt16LE(0, 6);                // flags
    localHeader.writeUInt16LE(method, 8);           // method
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);             // crc32
    localHeader.writeUInt32LE(compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(raw.length, 22);      // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);  // name length
    localHeader.writeUInt16LE(0, 28);               // extra length

    chunks.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);       // central dir signature
    centralHeader.writeUInt16LE(20, 4);               // version made by
    centralHeader.writeUInt16LE(20, 6);               // version needed
    centralHeader.writeUInt16LE(0, 8);                // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);               // extra
    centralHeader.writeUInt16LE(0, 32);               // comment
    centralHeader.writeUInt16LE(0, 34);               // disk
    centralHeader.writeUInt16LE(0, 36);               // internal attrs
    centralHeader.writeUInt32LE(0, 38);               // external attrs
    centralHeader.writeUInt32LE(offset, 42);          // offset
    central.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  const zipBuf = Buffer.concat([...chunks, centralBuf, end]);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), zipBuf);
  return { bytes: zipBuf.length, entries: entries.length };
}

// ============================================================
// Content builders
// ============================================================

function buildReadme(meta) {
  return `# SWS Proof of Attention — Evidence Kit

Generated: ${new Date().toISOString()}
Receipt sample: ${meta.receiptId}
Public key ID: ${meta.kid}
Issuer: ${meta.issuer}

---

## What this kit contains

Everything you need to qualify SWS in under ten minutes, offline, with no
SWS server involvement.

1. **part-11-mapping.md** — clause-by-clause walkthrough of 21 CFR Part 11
   mapped onto each receipt layer. Tagged TECH / MIXED / PROC — no
   overclaiming.

2. **sample-signed-receipt.json** — a real receipt signed with our
   production Ed25519 key. The JWT verifies against the public key in
   this same kit.

3. **sample-xapi-statement.json** — the same receipt expressed as an
   xAPI 1.0.3 Statement. Drop it into any Learning Record Store
   (Moodle, Canvas, Articulate, D2L, Cornerstone) to see the
   integration path.

4. **sample-openbadge.json** — the same receipt as a 1EdTech
   OpenBadges 3.0 AchievementCredential. Credly / Accredible /
   LinkedIn Learning compatible.

5. **verify-instructions.md** — four ways to verify the signature:
   browser (WebCrypto), Node.js, Python, and Go.

6. **public-key.jwk.json** — the JWKS snapshot. Match the 'kid' field
   to the 'kid' in the signed receipt's JWT header.

7. **integration-snippet.html** — the one-tag embed a buyer's web team
   would drop into an existing CME or training page.

8. **patent-reference.txt** — USPTO filing reference.

9. **behavioral-signals.md** — peer-reviewed citations for every
   behavioral signal in the composite.

---

## The thirty-second pitch

A cryptographic receipt that proves a human actually completed regulated
training — not a bot, not a click-through, not a GPT. Six layers in one
signed W3C Verifiable Credential:

    1. Environmental (BotD)          — real browser vs automation
    2. Behavioral (15 signals)       — engagement quality
    3. Composition Integrity         — authored vs pasted
    4. Consent attestation           — user authorized collection
    5. Ed25519 signature             — authentic issuer
    6. OpenTimestamps Bitcoin anchor — provably not backdated

Offline-verifiable with only our public key. 21 CFR Part 11 aligned.

---

## The pain point

- 327 FDA warning letters for 21 CFR Part 11 violations in H2 2025 alone.
- +73% year-over-year increase.
- Data integrity and audit trails are the #1 and #2 most-cited deficiencies.
- "Click-through completion" is no longer passing FDA inspection.
- LLMs make the old cheating defenses obsolete overnight.

---

## Next step

If you're the person on your side who'd run a 60-day pilot — one email:

  stephenfurpahs@gmail.com

Subject: "SWS pilot - [your org]"

No integration work beyond a single script tag. No data leaves your
infrastructure that wouldn't already be leaving it. We'll build the
validation package against your existing Part 11 procedures.

— Stephen Furpahs, SWS Strategic Media LLC
  Patent Pending SWS-PROV-001 · Filed 2026-03-17
`;
}

function buildVerifyInstructions() {
  return `# How to verify a SWS receipt offline

Given: a compact JWT (header.payload.signature) from
'sample-signed-receipt.json' and a JWK from 'public-key.jwk.json'.

You do NOT need to call any SWS server. The signature verifies against
the public key alone, in any language, any runtime.

## 1. Browser (WebCrypto API)

Works in Chrome 113+, Firefox 130+, Safari 17+.

\`\`\`html
<script>
async function verify(jwt, jwk) {
  const key = await crypto.subtle.importKey('jwk', jwk,
    { name: 'Ed25519' }, true, ['verify']);
  const [h, p, s] = jwt.split('.');
  const msg = new TextEncoder().encode(h + '.' + p);
  // base64url decode signature
  const pad = 4 - (s.length % 4); const b64 = (s + '='.repeat(pad%4))
    .replace(/-/g,'+').replace(/_/g,'/');
  const sig = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.verify({ name: 'Ed25519' }, key, sig, msg);
}
</script>
\`\`\`

Or just open https://sws-attention-proofs.web.app/verify.html and paste
the JWT — it renders all six layers with pass/fail chips.

## 2. Node.js (built-in crypto, no npm deps)

\`\`\`javascript
const crypto = require('crypto');
const fs = require('fs');

const jwt = fs.readFileSync('sample-signed-receipt.json', 'utf8');
const { signed_jwt } = JSON.parse(jwt);

const [h, p, s] = signed_jwt.split('.');
const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
if (!header.kid) throw new Error('JWT header missing kid');
const jwks = JSON.parse(fs.readFileSync('public-key.jwk.json','utf8'));
// Round-4 fan-out: strict kid match (no keys[0] fallback). Mirrors
// verify.html R2-2 / prove-humanness R3-2.
const jwk = jwks.keys.find(k => k.kid === header.kid);
if (!jwk) throw new Error('No JWK in JWKS matches kid=' + header.kid);

// Reconstruct the 32-byte Ed25519 public key from JWK
const rawPub = Buffer.from(jwk.x.replace(/-/g,'+').replace(/_/g,'/') + '=',
  'base64');
const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
const publicKeyObj = crypto.createPublicKey({
  key: Buffer.concat([spkiPrefix, rawPub]), format: 'der', type: 'spki'
});

const msg = Buffer.from(h + '.' + p, 'utf8');
const sigB64 = s.replace(/-/g,'+').replace(/_/g,'/');
const sig = Buffer.from(sigB64 + '='.repeat(4 - sigB64.length % 4),'base64');

console.log('Valid:', crypto.verify(null, msg, publicKeyObj, sig));
\`\`\`

## 3. Python

\`\`\`python
import json, base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

def b64url(s): return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))

with open('public-key.jwk.json') as f:
    jwk = json.load(f)['keys'][0]
pub = Ed25519PublicKey.from_public_bytes(b64url(jwk['x']))

with open('sample-signed-receipt.json') as f:
    jwt = json.load(f)['signed_jwt']
h, p, s = jwt.split('.')
try:
    pub.verify(b64url(s), (h + '.' + p).encode())
    print('Valid: True')
except Exception as e:
    print('Valid: False', e)
\`\`\`

## 4. Go (standard library)

\`\`\`go
import (
  "crypto/ed25519"
  "encoding/base64"
  "encoding/json"
  "os"
  "strings"
)

var jwk struct { Keys []struct { X string } }
json.Unmarshal(readFile("public-key.jwk.json"), &jwk)
pub, _ := base64.RawURLEncoding.DecodeString(jwk.Keys[0].X)

var receipt struct { SignedJwt string \`json:"signed_jwt"\` }
json.Unmarshal(readFile("sample-signed-receipt.json"), &receipt)
parts := strings.Split(receipt.SignedJwt, ".")
sig, _ := base64.RawURLEncoding.DecodeString(parts[2])

valid := ed25519.Verify(pub, []byte(parts[0]+"."+parts[1]), sig)
\`\`\`

---

## If verification fails

It means one of:
1. The JWT was tampered with in transit.
2. The signature is from a different key than the JWK supplied.
3. The JWK supplied doesn't match the \`kid\` in the JWT header.

None of these should happen with files from the same evidence kit.
If it does, something is wrong with the kit and we want to know:
stephenfurpahs@gmail.com.
`;
}

function buildIntegrationSnippet() {
  return `<!--
  SWS Proof of Attention — One-tag embed
  Drop this into any HTML page you want to instrument. No build step.
  Each session writes a signed, Bitcoin-anchored receipt to your
  analytics endpoint (or to the SWS public demo catalog, for trial use).
-->
<script src="https://sws-attention-proofs.web.app/embed.js"
        data-game-id="your-site-id"
        data-debug="false"
        data-save="true"></script>

<!--
  That's it. After ~30 seconds of engagement the SDK emits:

    window.SWSEmbed.getScore()        → { composite, timing, fitts, ... }
    window.SWSEmbed.getStats()        → { totalHashes, lastHash, ... }
    window.SWSEmbed.getSessionId()    → "embed_1776xxx_abc123"
    window.SWSEmbed.saveNow()         → force a Firestore flush

  Swap data-game-id for a recognizable identifier so your
  analytics can filter by page/audience/module.

  For production pilots you'll want to ingest the receipts into your
  own system. See xapi-adapter (CME LMS) and open-badge (OpenBadges 3.0)
  adapters in the SWS SDK for standard wire formats.
-->
`;
}

function buildPatentRef() {
  return `SWS Proof of Attention Protocol — Patent Reference

Filing entity:  SWS Strategic Media LLC
Inventor:       Stephen Furpahs
Application:    SWS-PROV-001
Filing type:    Provisional patent application
Filing date:    2026-03-17
Filing office:  United States Patent and Trademark Office (USPTO)

Core claims cover the specific combination of:

  - Multi-signal behavioral attention measurement (15 peer-reviewed
    behavioral-science signals combined into a tiered composite).

  - Environmental device-fingerprint gate as a separate disclosed layer.

  - Composition Integrity keystroke/paste-burst detector for
    LLM-assisted cheating discrimination.

  - Cryptographic attestation receipt combining Ed25519 digital
    signature, SHA-256 record integrity hash, and timestamp-authority
    anchor (OpenTimestamps / Bitcoin).

  - Consent attestation embedded in the signed record.

  - Issuance of the resulting receipt as a W3C Verifiable Credential,
    xAPI 1.0.3 statement, or 1EdTech OpenBadges 3.0 credential.

Application-specific patent claim text is not public during the
provisional period. Further inquiries: stephenfurpahs@gmail.com.
`;
}

function buildSignalsCite() {
  return `# Behavioral Signals — Peer-Reviewed Citations
## SDK 23-signal composite (20 weighted + 3 diagnostic-only)

Every signal in the SWS composite is grounded in published
behavioral-science research. Not novel research — validated foundations.

| Signal | Citation | Canonical statement |
|---|---|---|
| Fitts' Law | Fitts, P. M. (1954) | "The information capacity of the human motor system in controlling the amplitude of movement." *J. Experimental Psychology* 47(6): 381-391. |
| Hick's Law | Hick, W. E. (1952) | "On the rate of gain of information." *Quarterly J. Experimental Psychology* 4: 11-26. |
| Fractal 1/f Scaling | Gilden, D. L. (2001); Wagenmakers, Farrell & Ratcliff (2004) | "Cognitive emissions of 1/f noise." *Psych Review* 108(1): 33-56 + the Wagenmakers SRD critique paper we pre-empt with our prewhitened DFA-1 implementation. |
| Two-Thirds Power Law | Lacquaniti, Terzuolo & Viviani (1983) | "The law relating the kinematic and figural aspects of drawing movements." *Acta Psychologica* 54: 115-130. Cook et al. (2026 *Sci Rep*) confirms human β = -0.333 ± 0.03 SD. |
| Cursor Jerk (LDLJ) | Flash, T. & Hogan, N. (1985); Hogan & Sternad (2007) | "The coordination of arm movements: an experimentally confirmed mathematical model." *J. Neuroscience* 5(7): 1688-1703. |
| Velocity Profile (bell-shape) | Morasso, P. (1981) | "Spatial control of arm movements." *Experimental Brain Research* 42: 223-227. |
| Curvature Index | MacKenzie et al. (2001) | "Path optimization in mouse pointing tasks." Empirical human band CI = 1.1–1.8. |
| Scroll Saccade | Rayner, K. (1998) | "Eye movements in reading and information processing." *Psychological Bulletin* 124(3): 372-422. |
| Reading Speed Coherence | Lagun & Lalmas (WSDM 2016); Cole et al. (2011) | Viewport-time engagement at scale + scroll-and-dwell as gaze proxy. |
| Hover Dwell | Eelderink-Chen et al. mouse-hover literature | Pause distribution as attention proxy. |
| RT Variability | Esterman et al. (2013) | "In the zone or zoning out? Tracking behavioral and neural fluctuations during sustained attention." *Cerebral Cortex* 23(11): 2712-2723. |
| Scroll Backtracking | Khaokaew et al. (2024) | "The scroll is a search: reading comprehension from mobile interaction signals." *Google Research*. |
| Cross-Signal Correlation | Acien et al. (2022); Stragapede et al. (2024) | "BeCAPTCHA-Mouse: Synthetic mouse trajectories and improved bot detection." *Pattern Recognition* 127:108643; multimodal mobile fusion follow-ups. |
| **1/f Cross-Channel Coherence** (NEW 2026-04-26, diagnostic-only) | **Sklar (1959); Nandakumar et al. (2008 TPAMI); Harris & Wolpert (1998 Nature)** | The formal copula-based defense: signals must co-vary the way human biology produces them. Diagnostic-only weight 0 in v1 — proper firing requires ≥30 events on multiple structurally-independent channels. |
| **Microsaccades** (NEW 2026-04-26, diagnostic-only) | **Engbert & Kliegl (2003 *Vision Research* 43:1035); Hogan & Sternad (2007 *J Neurophys* 98:2238)** | 1–3 Hz involuntary cursor drift during idle windows — humans yes, simple bots no. Weight 0 because 60Hz Bezier sampling produces sample-pair displacements that look identical to real microsaccades; signal kept computed for diagnostic exposure. |
| **Submovement Count v2** (NEW 2026-04-26, weighted) | **Woodworth (1899); Crossman & Goodeve (1983); Meyer, Abrams, Kornblum, Wright, Smith (1988 *Psych Review* 95:340)** | Real ballistic mouse movements decompose into ballistic + 1–2 corrective submovements. Bezier bots produce single smooth velocity bell. v2 stricter peak detection (7-pt Gaussian smooth + 15% prominence + 80ms min-separation) catches Bezier-with-noise adversaries: DMTG-class bot 0.85 → 0.20 score. |
| Composition Integrity | Anonymous (2025) | "Detecting LLM-Assisted Academic Dishonesty using Keystroke Dynamics." arxiv:2511.12468. Reports 97-99% F1. |
| Device Motion Tremor | Randall et al. (2011); Acien (2020) BeCAPTCHA | "Biomechanical characteristics of hand tremor." *Clinical Neurophysiology* 122(3): 426-432. |
| Timing Entropy | Shannon, C. E. (1948); Wagenmakers & Brown (2007) | Shannon information substrate + Wagenmakers-Brown linear mean-SD law of human RT distributions. |
| Conformal Bayesian Posterior | Vovk, Gammerman, Shafer (2005); Angelopoulos & Bates (2023 arXiv:2107.07511) | Distribution-free finite-sample coverage. Class-conditional Gaussian likelihood-ratio with bootstrap 95% CI per Efron & Tibshirani 1993. Calibration grows with real-tester data. |

Research we explicitly DID NOT invent. SWS's contribution is the
specific combination, the tiered scoring, and the cryptographic
attestation envelope around the combined score.

For the formal defense of cross-signal coherence as a bot-detection
primitive (the white-space claim), see docs/yc-defense/09_cross_signal_coherence_math.md.

For the empirically-discovered structural limit (curve-aware Bezier
bots match human-typical statistics on individual motor signals; the
defense is layered, not single-signal), see SEVEN_LAYER_DEEP_DIVE_APR26_ADDENDUM.md.
`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = parseArgs(process.argv);
  const outPath = args.out || path.resolve(process.cwd(), 'dist/evidence-kit.zip');
  const repoRoot = path.resolve(__dirname, '..');

  // Find the most recent signed-receipt bundle to use as the sample
  let receiptPath = args.receipt;
  if (!receiptPath) {
    // Prefer the canonical seven-layer demo (all attestation fields
    // populated in credentialSubject), then six-layer, then stephen-0573.
    const candidates = [
      'proof/results/verify-sample-7layer.json',
      'proof/results/verify-sample-6layer.json',
      'proof/results/stephen-0573-anchored.json'
    ];
    for (const c of candidates) {
      const p = path.join(repoRoot, c);
      if (fs.existsSync(p)) { receiptPath = p; break; }
    }
  }
  if (!receiptPath || !fs.existsSync(path.resolve(receiptPath))) {
    console.error('No signed-receipt bundle found. Run run-bot-vs-human.js first or pass --receipt=path.');
    process.exit(1);
  }

  const receiptBundle = JSON.parse(fs.readFileSync(path.resolve(receiptPath), 'utf8'));
  const jwks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'proof/.well-known/attention-pubkey.json'), 'utf8'));

  // Round-4 fan-out: derive kid from the JWT header itself, not from
  // jwks.keys[0]. During key rotation [0] may be the new key while the
  // receipt was signed with the old; without this fix the evidence-kit
  // would write a key/kid mismatch into the bundle handed to lawyers.
  let derivedKid = receiptBundle.kid;
  if (!derivedKid && receiptBundle.signed_jwt) {
    try {
      const hdr = JSON.parse(Buffer.from(receiptBundle.signed_jwt.split('.')[0], 'base64url').toString('utf8'));
      derivedKid = hdr.kid;
    } catch (_) { /* fall through to unknown */ }
  }
  const meta = {
    receiptId: receiptBundle.signed_jwt ? 'embedded in signed_jwt' : 'unknown',
    kid: derivedKid || 'unknown',
    issuer: receiptBundle.issuer_did || receiptBundle.issuer || 'did:web:sws-attention-proofs.web.app'
  };

  // Derive xAPI + OpenBadge samples from the receipt JWT
  const xapi = require(path.join(repoRoot, 'src/sdk/xapi-adapter'));
  const ob = require(path.join(repoRoot, 'src/sdk/open-badge'));

  const xapiStatement = xapi.fromSignedJwt(receiptBundle.signed_jwt, {
    activityIri: 'https://example-cme-provider.org/module-101',
    activityType: 'http://adlnet.gov/expapi/activities/module'
  });

  // Reconstruct a receipt-shape dict from the JWT for OpenBadge
  const jwtPayload = JSON.parse(Buffer.from(
    receiptBundle.signed_jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),
    'base64'
  ).toString('utf8'));
  const vc = jwtPayload.vc || {};
  const subj = vc.credentialSubject || {};
  const eng = subj.engagement || {};
  const hv = subj.humanVerification || {};
  const receiptShape = {
    receipt_id: vc.id || 'urn:sws:evidence-sample',
    subject_id: subj.id || 'did:sws:anonymous',
    content_id: eng.contentId || 'evidence_sample',
    content_name: eng.contentName || 'Evidence Kit Sample',
    generated_at: vc.issuanceDate || new Date().toISOString(),
    engagement: {
      duration_ms: eng.durationMs || 0,
      focus_score: eng.focusScore || 0,
      quality_tier: eng.qualityTier || 'active',
      interaction_count: eng.interactionCount || 0
    },
    human_verification: {
      composite_score: hv.compositeScore || 0,
      verdict: hv.verdict || 'verified_human_active_engagement'
    },
    proof: {
      receipt_hash: (vc.proof && vc.proof.receiptHash) || 'sample'
    }
  };

  const achievement = ob.createAchievement({
    id: 'https://sws-attention-proofs.web.app/achievements/attention-verified-session',
    name: 'Attention-Verified Learning Session',
    description: 'Completed a learning session with cryptographically verified human attention.',
    criteriaNarrative: 'Behavioral composite >= 0.55 AND verified_human verdict AND granted consent AND Ed25519 signature validates.',
    tag: ['attention', 'proof-of-work', 'cme']
  });
  const obCred = ob.fromReceipt(receiptShape, achievement, { signedReceiptJwt: receiptBundle.signed_jwt });

  // Read the Part 11 mapping HTML and convert rough-and-ready to Markdown
  const part11Html = fs.readFileSync(path.join(repoRoot, 'proof/part-11.html'), 'utf8');
  const part11Md = htmlToMarkdownRough(part11Html);

  const entries = [
    { name: 'evidence-kit/README.md',                      data: buildReadme(meta) },
    { name: 'evidence-kit/part-11-mapping.md',             data: part11Md },
    { name: 'evidence-kit/sample-signed-receipt.json',     data: JSON.stringify(receiptBundle, null, 2) + '\n' },
    { name: 'evidence-kit/sample-xapi-statement.json',     data: JSON.stringify(xapiStatement, null, 2) + '\n' },
    { name: 'evidence-kit/sample-openbadge.json',          data: JSON.stringify({ achievement, openbadge_credential: obCred }, null, 2) + '\n' },
    { name: 'evidence-kit/verify-instructions.md',         data: buildVerifyInstructions() },
    { name: 'evidence-kit/public-key.jwk.json',            data: JSON.stringify(jwks, null, 2) + '\n' },
    { name: 'evidence-kit/integration-snippet.html',       data: buildIntegrationSnippet() },
    { name: 'evidence-kit/patent-reference.txt',           data: buildPatentRef() },
    { name: 'evidence-kit/behavioral-signals.md',          data: buildSignalsCite() }
  ];

  const result = writeZip(entries, outPath);
  console.log('Evidence kit written: ' + outPath);
  console.log('  files:   ' + result.entries);
  console.log('  bytes:   ' + result.bytes.toLocaleString());
  console.log('  receipt: ' + path.relative(repoRoot, receiptPath));
  console.log('  kid:     ' + meta.kid);
}

// Very rough HTML → Markdown converter for the Part 11 page.
// We don't need pixel-perfect — just legible in a text editor.
function htmlToMarkdownRough(html) {
  // Strip head + styles + scripts
  let s = html.replace(/<head[\s\S]*?<\/head>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<nav[\s\S]*?<\/nav>/gi, '');
  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
       .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
       .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  // Callouts as blockquotes
  s = s.replace(/<div class="callout[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '\n> $1\n');
  // Tables
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map(c => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      return '| ' + cells.join(' | ') + ' |';
    });
    if (rows.length === 0) return '';
    return '\n' + rows.join('\n') + '\n';
  });
  // Paragraphs & breaks
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
       .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
       .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
       .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  // Strip everything else
  s = s.replace(/<[^>]+>/g, '')
       .replace(/&nbsp;/g, ' ')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/\n{3,}/g, '\n\n');
  return s.trim() + '\n';
}

main().catch(e => { console.error('ERROR:', e && (e.stack || e.message)); process.exit(1); });
