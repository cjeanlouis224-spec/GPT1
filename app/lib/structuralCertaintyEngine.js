export function computeStructuralCertainty({
  symbol,
  chainSummary,
  mode = "DAILY"
}) {
  if (!chainSummary) {
    return {
      symbol,
      allowed: false,
      reason: "NO_CHAIN_DATA"
    };
  }

  const {
    pc_ratio,
    calls_total,
    puts_total,
    max_pain
  } = chainSummary;

  // ----- Regime -----
  let regime = "NEUTRAL";
  if (pc_ratio >= 1.8) regime = "BEAR_CONTROLLED";
  else if (pc_ratio <= 0.7) regime = "BULL_CONTROLLED";

  // ----- Direction Gate -----
  let direction = "NO_TRADE";
  if (regime === "BEAR_CONTROLLED") direction = "SHORT_BIAS";
  if (regime === "BULL_CONTROLLED") direction = "LONG_BIAS";

  // ----- Mode filter -----
  let allowed = regime !== "NEUTRAL";

  if (mode === "SWING" && regime === "NEUTRAL") {
    allowed = false;
  }

  return {
    symbol,
    mode,
    regime,
    direction,
    pc_ratio,
    calls_total,
    puts_total,
    max_pain,
    allowed
  };
}
