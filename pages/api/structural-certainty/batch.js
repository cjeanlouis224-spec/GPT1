// pages/api/structural-certainty/batch.js

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${url}`);
  return r.json();
}

/* =========================
   STRUCTURAL LOGIC
========================= */

function deriveDirection({ shortVolRatio, shortInterestChange, borrowRate }) {
  if (shortVolRatio > 0.55 && shortInterestChange >= 0 && borrowRate > 3)
    return "DOWN";

  if (shortVolRatio < 0.45 && shortInterestChange < 0)
    return "UP";

  return "NEUTRAL";
}

function deriveRegime({ shortVolRatio, borrowRate }) {
  if (shortVolRatio > 0.55 && borrowRate > 3) return "BEAR_CONTROLLED";
  if (shortVolRatio < 0.45 && borrowRate < 2) return "BULL_CONTROLLED";
  return "TRANSITIONAL";
}

function deriveDirectionGate(direction) {
  if (direction === "DOWN") return "SHORT_BIAS_INTRADAY";
  if (direction === "UP") return "LONG_BIAS_INTRADAY";
  return "MEAN_REVERSION_ONLY";
}

function deriveExecutionMode({ regime, direction }) {
  if (regime === "BEAR_CONTROLLED" && direction === "DOWN")
    return "SHORT_SCALPS_FAVORED";
  if (regime === "BULL_CONTROLLED" && direction === "UP")
    return "LONG_SCALPS_FAVORED";
  return "SELECTIVE / REDUCED_SIZE";
}

function deriveAllowedTrades(direction) {
  if (direction === "DOWN") {
    return [
      "Short failed pops into VWAP / prior day high",
      "Sell call-side rips; avoid chasing breakdowns",
      "Favor downside momentum scalps after weak bounces",
      "Cover partials quickly at intraday supports"
    ];
  }

  if (direction === "UP") {
    return [
      "Buy pullbacks into VWAP / prior day low",
      "Sell put-side flushes; avoid chasing breakouts",
      "Favor upside momentum after consolidation",
      "Trim into intraday resistance"
    ];
  }

  return [
    "Mean reversion only",
    "Fade extremes into VWAP",
    "Avoid trend continuation trades"
  ];
}

/* =========================
   SYMBOL EVALUATION
========================= */

async function evaluateSymbol(symbol, base) {
  const [
    shortVol,
    shortInterest,
    borrow
  ] = await Promise.all([
    fetchJSON(`${base}/short-volume?symbol=${symbol}`),
    fetchJSON(`${base}/short-interest-daily?symbol=${symbol}`),
    fetchJSON(`${base}/borrow-fee?symbol=${symbol}`)
  ]);

  const shortVolRatio =
    shortVol?.short_volume_ratio ??
    shortVol?.shortVolumeRatio ??
    0.5;

  const shortInterestChange =
    shortInterest?.change ??
    shortInterest?.change_pct ??
    0;

  const borrowRate =
    borrow?.rate ??
    borrow?.borrow_rate ??
    0;

  const direction = deriveDirection({
    shortVolRatio,
    shortInterestChange,
    borrowRate
  });

  const regime = deriveRegime({
    shortVolRatio,
    borrowRate
  });

  return {
    symbol,
    A_regime: {
      regime,
      direction,
      shortVolRatio,
      shortInterestChange,
      borrowRate
    },
    B_direction_gate: deriveDirectionGate(direction),
    C_execution_mode: deriveExecutionMode({ regime, direction }),
    D_allowed_trades: deriveAllowedTrades(direction),
    summary: {
      structural_direction: direction,
      primary_risk:
        direction === "DOWN"
          ? "Sharp bear-market rallies squeezing shorts"
          : direction === "UP"
          ? "Fast downside reversals after long positioning"
          : "False breakouts in low-certainty regime"
    }
  };
}

/* =========================
   API HANDLER
========================= */

export default async function handler(req, res) {
  try {
    const base = `https://${req.headers.host}/api/cex`;

    const symbols = ["SPY", "QQQ", "IWM"];

    const results = await Promise.all(
      symbols.map(sym => evaluateSymbol(sym, base))
    );

    res.status(200).json({
      date: new Date().toISOString().slice(0, 10),
      marketStatus: "closed",
      results
    });

  } catch (err) {
    res.status(500).json({
      error: "Structural Certainty batch failed",
      detail: err.message
    });
  }
}
