// pages/api/structural-certainty/batch.js

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${url}`);
  return r.json();
}

/* =========================
   STRUCTURAL LOGIC
   ========================= */

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

  // ⚠️ THIS ARRAY MUST CLOSE BEFORE ANY FUNCTION
  return [
    "Mean reversion only",
    "Fade extremes into VWAP",
    "Avoid trend continuation trades"
  ];
}

/* =========================
   CONFIDENCE ENGINE
   ========================= */

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
  if (borrowRate > 5) score += 20;
  else if (borrowRate > 2) score += 10;

  // Regime alignment (0–20)
  if (regime === "TREND" && direction !== "NEUTRAL") score += 20;
  if (regime === "RANGE" && direction === "NEUTRAL") score += 10;

  // Directional clarity (0–20)
  if (direction !== "NEUTRAL") score += 20;

  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}

/* =========================
   API HANDLER
   ========================= */

export default async function handler(req, res) {
    // Prevent caching (critical for live market data)
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    if (!symbolsParam || typeof symbolsParam !== "string") {
  return res.status(400).json({
    error: "Missing or invalid symbols parameter",
    example: "?symbols=SPY,QQQ,IWM"
  });
}
    const data = await fetchJSON(
      `https://chartexchange.com/api/v1/data/options/chain-summary/?symbol=${symbol}`
    );

    const row = data?.[0] || {};

    const shortVolRatio = Number(row.short_volume_ratio ?? 0.5);
    const shortInterestChange = Number(row.short_interest_change ?? 0);
    const borrowRate = Number(row.borrow_rate ?? 0);
    const regime = row.regime || "RANGE";

    const direction = deriveDirection({
      shortVolRatio,
      shortInterestChange
    });

    const allowedTrades = deriveAllowedTrades(direction);

    const confidence = deriveConfidence({
      shortVolRatio,
      shortInterestChange,
      borrowRate,
      regime,
      direction
    });

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
