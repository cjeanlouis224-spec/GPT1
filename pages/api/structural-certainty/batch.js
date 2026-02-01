// pages/api/structural-certainty/batch.js

/* ======================================================
   STEP 0 — Helpers
====================================================== */

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${url}`);
  return r.json();
}

/* ======================================================
   STEP 2 — Direction + Allowed Trades
====================================================== */

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
      "Favor downside momentum only after weak bounces",
      "Cover partials quickly into intraday supports"
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

/* ======================================================
   STEP 4 — Regime Transition Detection
====================================================== */

function pressureDivergence({ shortVolRatio, shortInterestChange, direction }) {
  if (direction === "DOWN") {
    return shortVolRatio < 0.50 && shortInterestChange >= 0;
  }
  if (direction === "UP") {
    return shortVolRatio > 0.50 && shortInterestChange <= 0;
  }
  return false;
}

function borrowWeakening(borrowRate) {
  return borrowRate < 2;
}

function detectRegimeTransition({
  regime,
  shortVolRatio,
  shortInterestChange,
  borrowRate,
  direction
}) {
  const causes = [];

  if (pressureDivergence({ shortVolRatio, shortInterestChange, direction })) {
    causes.push("pressure_divergence");
  }

  if (borrowWeakening(borrowRate)) {
    causes.push("borrow_weakening");
  }

  if (causes.length >= 2) {
    return {
      detected: true,
      from: regime,
      to: "TRANSITIONAL",
      causes
    };
  }

  return {
    detected: false,
    from: regime,
    to: regime,
    causes: []
  };
}

/* ======================================================
   STEP 3 — Confidence Calibration (0–100)
====================================================== */

function deriveConfidence({
  shortVolRatio,
  shortInterestChange,
  borrowRate,
  regime,
  direction
}) {
  let score = 0;

  // Structural pressure (0–40)
  if (direction === "DOWN") {
    if (shortVolRatio > 0.55) score += 20;
    if (shortInterestChange > 0) score += 20;
  }

  if (direction === "UP") {
    if (shortVolRatio < 0.45) score += 20;
    if (shortInterestChange < 0) score += 20;
  }

  // Borrow friction (0–20)
  if (borrowRate > 5) score += 20;
  else if (borrowRate > 2) score += 10;

  // Regime multiplier (dominant control)
  const regimeMultiplier = {
    EXPANSION: 1.0,
    CONTRACTION: 0.9,
    TRANSITIONAL: 0.6,
    MEAN_REVERSION: 0.4
  };

  score *= regimeMultiplier[regime] ?? 0.5;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/* ======================================================
   STEP 1 — API HANDLER (Cache + Guard)
====================================================== */

export default async function handler(req, res) {
  // 🔒 Disable caching
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const symbolsParam = req.query.symbols;

    // Input guard
    if (!symbolsParam || typeof symbolsParam !== "string") {
      return res.status(400).json({
        error: "Missing or invalid symbols parameter",
        example: "?symbols=SPY,QQQ,IWM"
      });
    }

    const symbols = symbolsParam
      .split(",")
      .map(s => s.trim().toUpperCase());

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

      let regime = "MEAN_REVERSION";
      if (pcRatio >= 2.0) regime = "CONTRACTION";
      else if (pcRatio <= 0.7) regime = "EXPANSION";

      const direction = deriveDirection({
        shortVolRatio,
        shortInterestChange
      });

      const transition = detectRegimeTransition({
        regime,
        shortVolRatio,
        shortInterestChange,
        borrowRate,
        direction
      });

      if (transition.detected) {
        regime = "TRANSITIONAL";
      }

      const confidence = deriveConfidence({
        shortVolRatio,
        shortInterestChange,
        borrowRate,
        regime,
        direction
      });

      results.push({
        symbol,
        regime,
        direction,
        confidence,
        execution_model:
          confidence >= 80
            ? "AGGRESSIVE"
            : confidence >= 60
            ? "SELECTIVE"
            : confidence >= 40
            ? "MEAN_REVERSION_ONLY"
            : "NO_TRADE",
        allowed_trades: deriveAllowedTrades(direction),
        regime_transition: transition
      });
    }

    res.status(200).json({
      date: new Date().toISOString().slice(0, 10),
      results
    });
  } catch (err) {
    res.status(500).json({
      error: "Structural Certainty failed",
      detail: err.message
    });
  }
}
