// pages/api/structural-certainty/batch.js

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Fetch failed: ${url}`);
  }
  return r.json();
}

/* ================================
   CORE DERIVATION FUNCTIONS
================================ */

function deriveDirection({ shortVolRatio, shortInterestChange }) {
  if (shortVolRatio > 0.55 && shortInterestChange > 0) return "DOWN";
  if (shortVolRatio < 0.45 && shortInterestChange < 0) return "UP";
  return "NEUTRAL";
}

function deriveRegime({ pcRatio }) {
  if (pcRatio >= 2.0) return "BEAR_CONTROLLED";
  if (pcRatio <= 0.7) return "BULL_CONTROLLED";
  return "BALANCED";
}

function deriveExecutionMode(direction) {
  if (direction === "DOWN") return "SHORT_SCALPS_FAVORED";
  if (direction === "UP") return "LONG_SCALPS_FAVORED";
  return "MEAN_REVERSION_ONLY";
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

function deriveConfidence({
  shortVolRatio,
  shortInterestChange,
  borrowRate,
  regime,
  direction
}) {
  let score = 0;

  // Short pressure (0–40)
  if (shortVolRatio > 0.6) score += 20;
  if (shortInterestChange > 0) score += 20;

  // Borrow stress (0–20)
  if (borrowRate > 5) score += 10;
  if (borrowRate > 10) score += 10;

  // Structural alignment (0–40)
  if (regime === "BEAR_CONTROLLED" && direction === "DOWN") score += 40;
  if (regime === "BULL_CONTROLLED" && direction === "UP") score += 40;

  if (score >= 80) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

/* ================================
   API HANDLER
================================ */

export default async function handler(req, res) {
  try {
    const symbolsParam = req.query.symbols;
    if (!symbolsParam) {
      return res.status(400).json({ error: "Missing symbols param" });
    }

    const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase());

    const base =
      req.headers.origin ||
      `https://${req.headers.host}`;

    const results = [];

    for (const symbol of symbols) {
      const [
        chain,
        shortVol,
        shortInterest,
        borrow
      ] = await Promise.all([
        fetchJSON(`${base}/api/cex/chain-summary?symbol=${symbol}`),
        fetchJSON(`${base}/api/cex/short-volume?symbol=${symbol}`),
        fetchJSON(`${base}/api/cex/short-interest-daily?symbol=${symbol}`),
        fetchJSON(`${base}/api/cex/borrow-fee?symbol=${symbol}`)
      ]);

      const pcRatio = chain?.pc_ratio ?? 1;
      const shortVolRatio = shortVol?.short_volume_ratio ?? 0.5;
      const shortInterestChange = shortInterest?.change ?? 0;
      const borrowRate = borrow?.borrow_rate ?? 0;

      const regime = deriveRegime({ pcRatio });
      const direction = deriveDirection({ shortVolRatio, shortInterestChange });
      const executionMode = deriveExecutionMode(direction);
      const allowedTrades = deriveAllowedTrades(direction);
      const confidence = deriveConfidence({
        shortVolRatio,
        shortInterestChange,
        borrowRate,
        regime,
        direction
      });

      results.push({
        symbol,
        A_regime: {
          regime,
          pcRatio
        },
        B_direction_gate: direction,
        C_execution_mode: executionMode,
        D_allowed_trades: allowedTrades,
        confidence
      });
    }

    res.status(200).json({
      date: new Date().toISOString().slice(0, 10),
      marketStatus: "OPEN_OR_RECENT",
      results
    });
  } catch (err) {
    res.status(500).json({
      error: "Structural Certainty failed",
      detail: err.message
    });
  }
}
