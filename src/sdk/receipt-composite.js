/**
 * SWS Attention Protocol — Receipt-wide Gated Composite
 *
 * Computes a receipt-aggregate "final" composite score that gates the
 * pure behavioral composite on the independent integrity layers
 * (environmental bot-gate, composition integrity, honeypot canary).
 *
 * Design:
 *   - The *behavioral* composite (src/sdk/attention-protocol.js) remains
 *     a pure 23-signal motor + keystroke + decision + cognitive-coherence
 *     score (21 weighted + 2 diagnostic-only). Unchanged in shape.
 *   - The *receipt-wide* final composite applies defense-in-depth caps:
 *     if any independent integrity layer flags the session, the final
 *     composite cannot exceed a ceiling appropriate to that flag.
 *   - Both values + the list of gates applied are surfaced in the
 *     receipt, so auditors see the raw behavioral measure AND the
 *     gated judgment, with provenance.
 *
 * Gates (current thresholds; conservative):
 *   environmental.bot === true ................ cap 0.30
 *   compositionIntegrity.verdict 'pasted'|'mechanical' ... cap 0.40
 *   compositionIntegrity.verdict 'suspicious' .. cap 0.50
 *   honeypot.tripped === true .................. cap 0.25
 *
 * Rationale:
 *   - Not a rebrand of BotD: the behavioral composite still contributes;
 *     the gate only *caps* the aggregate. When no layer flags, final ==
 *     behavioral.
 *   - Not circularity: every gate is an independent signal with its own
 *     detector. Defense-in-depth is the architectural pattern.
 *   - Transparent: gatesApplied enumerates every cap with its reason, so
 *     a reviewer can see exactly why final < behavioral in any session.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

var VERSION = 'receipt-composite-v1';

// Gate thresholds. Exposed for test-time override and future calibration.
var DEFAULT_GATES = Object.freeze({
  environmentalBot: 0.30,
  compositionPasted: 0.40,
  compositionMechanical: 0.40,
  compositionSuspicious: 0.50,
  honeypotTripped: 0.25
});

/**
 * Map a final composite score to a quality tier.
 * Thresholds match src/sdk/attention-protocol.js#getMaxTier exactly,
 * so the "tier" a buyer sees is consistent whether derived from behavioral
 * or final composite. Differences then show up in the tier label alone.
 */
function tierForScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return 'unknown';
  if (score > 0.75) return 'deep';
  if (score > 0.50) return 'active';
  if (score > 0.25) return 'passive';
  return 'background';
}

/**
 * Compute the receipt-wide final composite.
 *
 * @param {Object} inputs
 * @param {number} inputs.behavioralComposite - in [0, 1]
 * @param {Object} [inputs.environmental] - { loaded, bot, botKind, detector, ... }
 * @param {Object} [inputs.compositionIntegrity] - { verdict, score, ... }
 * @param {Object} [inputs.honeypot] - { tripped, strategiesUsed, ... }
 * @param {Object} [inputs.gates] - optional override map (see DEFAULT_GATES)
 *
 * @returns {Object} {
 *   finalComposite: number,            // in [0, 1], always <= behavioralComposite
 *   behavioralComposite: number,       // echoed for convenience
 *   gatesApplied: Array<{layer, reason, cap}>,
 *   tierFinal: 'deep'|'active'|'passive'|'background'|'unknown',
 *   version: string
 * }
 */
function computeFinalComposite(inputs) {
  inputs = inputs || {};
  var bc = inputs.behavioralComposite;
  if (typeof bc !== 'number' || isNaN(bc)) bc = 0;
  if (bc < 0) bc = 0;
  if (bc > 1) bc = 1;

  var gates = (inputs.gates && typeof inputs.gates === 'object') ? inputs.gates : DEFAULT_GATES;
  var applied = [];
  var cap = 1.0;

  // --- Gate 1: environmental bot detection ---
  var env = inputs.environmental;
  if (env && env.loaded === true && env.bot === true) {
    var envCap = gates.environmentalBot != null ? gates.environmentalBot : DEFAULT_GATES.environmentalBot;
    if (envCap < cap) cap = envCap;
    applied.push({
      layer: 'environmental',
      reason: env.botKind ? ('bot_detected:' + env.botKind) : 'bot_detected',
      cap: envCap
    });
  }

  // --- Gate 2: composition integrity ---
  var ci = inputs.compositionIntegrity;
  if (ci && typeof ci.verdict === 'string') {
    if (ci.verdict === 'pasted') {
      var pCap = gates.compositionPasted != null ? gates.compositionPasted : DEFAULT_GATES.compositionPasted;
      if (pCap < cap) cap = pCap;
      applied.push({ layer: 'compositionIntegrity', reason: 'pasted', cap: pCap });
    } else if (ci.verdict === 'mechanical') {
      var mCap = gates.compositionMechanical != null ? gates.compositionMechanical : DEFAULT_GATES.compositionMechanical;
      if (mCap < cap) cap = mCap;
      applied.push({ layer: 'compositionIntegrity', reason: 'mechanical', cap: mCap });
    } else if (ci.verdict === 'suspicious') {
      var sCap = gates.compositionSuspicious != null ? gates.compositionSuspicious : DEFAULT_GATES.compositionSuspicious;
      if (sCap < cap) cap = sCap;
      applied.push({ layer: 'compositionIntegrity', reason: 'suspicious', cap: sCap });
    }
    // 'authored' | 'unknown' -> no cap (authored passes cleanly; unknown means insufficient data to flag)
  }

  // --- Gate 3: honeypot canary ---
  var hp = inputs.honeypot;
  if (hp && hp.tripped === true) {
    var hCap = gates.honeypotTripped != null ? gates.honeypotTripped : DEFAULT_GATES.honeypotTripped;
    if (hCap < cap) cap = hCap;
    applied.push({ layer: 'honeypot', reason: 'canary_tripped', cap: hCap });
  }

  var finalScore = Math.min(bc, cap);

  return {
    finalComposite: finalScore,
    behavioralComposite: bc,
    gatesApplied: applied,
    tierFinal: tierForScore(finalScore),
    version: VERSION
  };
}

// UMD-style export: Node and (optionally) browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeFinalComposite: computeFinalComposite,
    tierForScore: tierForScore,
    DEFAULT_GATES: DEFAULT_GATES,
    VERSION: VERSION
  };
}
if (typeof window !== 'undefined') {
  window.SWSReceiptComposite = {
    computeFinalComposite: computeFinalComposite,
    tierForScore: tierForScore,
    DEFAULT_GATES: DEFAULT_GATES,
    VERSION: VERSION
  };
}
