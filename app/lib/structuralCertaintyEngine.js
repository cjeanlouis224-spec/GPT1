/**
 * Structural Certainty Engine
 * Uses ChartExchange chain-summary + exchange volume
 * Front-month expiration is IMPLIED by chain-summary
 */

export function structuralCertaintyEngine({
  symbol,
  chain,
  exchangeVolume
}) {
  // ---------- FAIL FAST ----------
  if (!chain) {
    return {
      symbol,
      regime: "UNKNOWN",
      bias: {
        direction: "NO_TRADE",
        confidence: 0,
        disallowed: ["LONG", "SHORT"],
        drivers: ["missing_chain_data"]
      },
      invalidation: "Chain summary unavailable"
    };
  }

  const {
    pc_ratio,
    calls_total,
    puts_total,
    itm_calls = 0,
    itm_puts = 0,
    max_pain
  } = chain;

  // ---------- REGIME CLASSIFICATION ----------
  let regime = "MIXED";
  // ---------- DRIVERS ----------
const drivers = [];

  if (pc_ratio >= 1.6) regime = "BEAR_CONTROLLED";
  else if (pc_ratio <= 0.65) regime = "BULL_CONTROLLED";

  // ---------- DIRECTION GATE ----------
  let direction = "NEUTRAL";
  let disallowed = [];

  if (regime === "BEAR_CONTROLLED") {
    direction = "SHORT_BIAS_INTRADAY";
    disallowed = ["LONG"];
  }

  if (regime === "BULL_CONTROLLED") {
    direction = "LONG_BIAS_INTRADAY";
    disallowed = ["SHORT"];
  }

  if (regime === "MIXED") {
    direction = "NO_TRADE";
    disallowed = ["LONG", "SHORT"];
  }

 
 // ---------- CONFIDENCE MODEL ----------
let confidence = 0;

// Base confidence from PC ratio alone
if (pc_ratio >= 1.6 || pc_ratio <= 0.65) {
  confidence += Math.min(40, Math.abs(pc_ratio - 1) * 20);
}

// Flow imbalance (if totals exist)
if (calls_total > 0 && puts_total > 0) {
  const flowImbalance =
    Math.abs(calls_total - puts_total) /
    (calls_total + puts_total);

  confidence += flowImbalance * 30;
}

// ITM confirmation (optional boost, NOT required)
if (itm_calls + itm_puts > 0) {
  const itmImbalance =
    Math.abs(itm_calls - itm_puts) /
    (itm_calls + itm_puts);

  confidence += itmImbalance * 30;
}

confidence = Math.min(100, Math.round(confidence));

// ---------- CONFIDENCE FLOOR ----------
if (confidence < 12) {
  direction = "NO_TRADE";
  disallowed = ["LONG", "SHORT"];
  drivers.push("low_structural_conviction");
}

  // ---------- EXECUTION MODE ----------
  let execution = "NONE";

  if (direction === "SHORT_BIAS_INTRADAY") {
    execution = "Short scalps favored; sell failed pops";
  }

  if (direction === "LONG_BIAS_INTRADAY") {
    execution = "Long scalps favored; buy dips above VWAP";
  }

  // ---------- OUTPUT ----------
  return {
    symbol,
    regime,
    pc_ratio,
    calls_total,
    puts_total,
    max_pain,
    bias: {
      direction,
      confidence,
      disallowed,
      drivers
    },
    execution,
    invalidation:
      "PC ratio normalization or ITM dominance flip"
  };
}
