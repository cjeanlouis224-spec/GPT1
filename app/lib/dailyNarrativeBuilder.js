export function dailyNarrativeBuilder({ symbol, chain, regime }) {
  const {
    pc_ratio,
    calls_total,
    puts_total
  } = chain;

  // -----------------------------
  // Direction Gate (SOFT)
  // -----------------------------
  let directionGate = "NEUTRAL_INTRADAY";
  let executionMode = "Balanced tape";
  let allowedTrades = [];
  let primaryRisk = "Chop / indecision";

  // -----------------------------
  // Bear-leaning tape
  // -----------------------------
  if (pc_ratio >= 1.5 && puts_total > calls_total) {
    directionGate = "SHORT_BIAS_INTRADAY";
    executionMode = "Short scalps favored";

    allowedTrades = [
      "Short failed pops into VWAP / prior day high",
      "Sell call-side rips; avoid chasing breakdowns",
      "Favor downside momentum scalps after weak bounces",
      "Cover partials quickly at intraday supports"
    ];

    primaryRisk =
      "Sharp bear-market rallies squeezing shorts";
  }

  // -----------------------------
  // Bull-leaning tape
  // -----------------------------
  if (pc_ratio <= 0.7 && calls_total > puts_total) {
    directionGate = "LONG_BIAS_INTRADAY";
    executionMode = "Long scalps favored";

    allowedTrades = [
      "Buy pullbacks into VWAP or rising MAs",
      "Favor call-side momentum after consolidation",
      "Scale partials into strength",
      "Avoid chasing extended upside"
    ];

    primaryRisk =
      "Fast rug-pull reversals after upside exhaustion";
  }

  // -----------------------------
  // Output (Narrative, not gating)
  // -----------------------------
  return {
    symbol,
    regime,
    directionGate,
    executionMode,
    allowedTrades,
    primaryRisk
  };
}
