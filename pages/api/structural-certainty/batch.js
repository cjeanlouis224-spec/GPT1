// pages/api/structural-certainty/batch.js

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${url}`);
  return r.json();
}

/* ===============================
   STRUCTURAL LOGIC
================================ */

function deriveDirection({ shortVolRatio, shortInterestChange }) {
  if (shortVolRatio > 0.55 && shortInterestChange > 0) return "DOWN";
  if (shortVolRatio < 0.45 && shortInterestChange < 0) return "UP";
  return "NEUTRAL";
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
} // ✅ ARRAY IS CLOSED HERE — THIS WAS THE BUG

function deriveConfidence({
  shortVolRatio,
  shortInterestChange,
  borrowRate,
  regime,
  direction
}) {
  let score = 0;

  // A) Short pressure (0–40)
  if (shortVolRatio > 0.6) score += 20;
  if (shortInterestChange > 0) score += 20;

  // B) Borrow stress (0–20)
  if (borrowRate > 5) score += 10;
  if (borrowRate > 10) score += 10;

  // C) Regime alignment (0–20)
  if (regime === "TREND" && direction !== "NEUTRAL") score += 20;

  // D) Direction clarity (0–20)
  if (direction !== "NEUTRAL") score += 20;

  return Math.min(score, 100);
}

/* ===============================
   API HANDLER
================================ */

export default async function handler(req, res) {
  try {
    const { symbol = "SPY" } = req.query;

    const chainURL = `https://gpt-1-mu-five.vercel.app/api/cex/chain-summary?symbol=${symbol}`;
    const chain = await fetchJSON(chainURL);

    const inputs = {
      shortVolRatio: chain.shortVolumeRatio ?? 0.5,
      shortInterestChange: chain.shortInterestChange ?? 0,
      borrowRate: chain.borrowRate ?? 0,
      regime: chain.regime ?? "RANGE"
    };

    const direction = deriveDirection(inputs);
    const confidence = deriveConfidence({ ...inputs, direction });
    const allowedTrades = deriveAllowedTrades(direction);

    res.status(200).json({
      symbol,
      direction,
      confidence,
      allowedTrades
    });
  } catch (err) {
    res.status(500).json({
      error: "Structural Certainty failed",
      detail: err.message
    });
  }
}
