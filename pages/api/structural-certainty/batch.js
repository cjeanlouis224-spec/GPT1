// pages/api/structural-certainty/batch.js

/* ======================================================
   HELPERS
====================================================== */

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${url}`);
  return r.json();
}

/* ======================================================
   STEP 2 — DIRECTION + ALLOWED TRADES
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
      "Favor downside momentum after weak bounces",
      "Cover partials into intraday support"
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
   STEP 4 — REGIME TRANSITION DETECTION
====================================================== */

function pressureDivergence({ shortVolRatio, shortInterestChange, direction }) {
  if (direction === "DOWN") return shortVolRatio < 0.5 && shortInterestChange >= 0;
  if (direction === "UP") return shortVolRatio > 0.5 && shortInterestChange <= 0;
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

  if (pressureDivergence({ shortVolRatio, shortInterestChange, direction }))
    causes.push("pressure_divergence");

  if (borrowWeakening(borrowRate))
    causes.push("borrow_weakening");

  if (causes.length >= 2) {
    return { detected: true, from: regime, to: "TRANSITIONAL", causes };
  }

  return { detected: false, from: regime, to: regime, causes: [] };
}

/* ======================================================
   STEP 3 — CONFIDENCE ENGINE (0–100)
====================================================== */

function deriveConfidence({
  shortVolRatio,
  shortInterestChange,
  borrowRate,
  regime,
  direction
}) {
  let score = 0;

  if (direction === "DOWN") {
    if (shortVolRatio > 0.55) score += 20;
    if (shortInterestChange > 0) score += 20;
  }

  if (direction === "UP") {
    if (shortVolRatio < 0.45) score += 20;
    if (shortInterestChange < 0) score += 20;
  }

  if (borrowRate > 5) score += 20;
  else if (borrowRate > 2) score += 10;

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
   STEP 8 — VOLATILITY GATE (VIX)
====================================================== */

async function fetchVIX(base) {
  try {
    const r = await fetch(`${base}/api/market/vix`);
    if (!r.ok) return null;
    const j = await r.json();
    return Number(j.vix);
  } catch {
    return null;
  }
}

function classifyVolatility(vix) {
  if (vix == null) return "UNKNOWN";
  if (vix >= 22) return "EXPANSION";
  if (vix <= 15) return "COMPRESSION";
  return "NEUTRAL";
}

function applyVolatilityGate({ volatility, confidence, executionModel }) {
  if (volatility === "EXPANSION") {
    return {
      executionModel: "MEAN_REVERSION_ONLY",
      confidence: Math.min(confidence, 55),
      note: "Volatility expansion — trend continuation disabled"
    };
  }
  return { executionModel, confidence, note: null };
}

/* ======================================================
   STEP 9 — WEEKLY / DAILY HIERARCHY
====================================================== */

async function fetchWeeklyRegime(symbol, base) {
  try {
    const r = await fetch(
      `${base}/api/structural-certainty/weekly?symbol=${symbol}`
    );
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

function resolveHierarchy({ weekly, daily }) {
  if (!weekly) return { ...daily, source: "DAILY_ONLY" };

  if (weekly.confidence >= 70) {
    return {
      regime: weekly.regime,
      direction: weekly.direction,
      confidence: Math.min(weekly.confidence, daily.confidence),
      source: "WEEKLY_OVERRIDE"
    };
  }

  return { ...daily, source: "DAILY_PRIMARY" };
}

/* ======================================================
   STEP 1 — API HANDLER (CACHE + INPUT GUARD)
====================================================== */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const symbolsParam = req.query.symbols;
    if (!symbolsParam || typeof symbolsParam !== "string") {
      return res.status(400).json({
        error: "Missing or invalid symbols parameter",
        example: "?symbols=SPY,QQQ,IWM"
      });
    }

    const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase());
    const base = `https://${req.headers.host}`;

    const vix = await fetchVIX(base);
    const volatility = classifyVolatility(vix);

    const results = [];

    for (const symbol of symbols) {
      const [chain, shortVol, shortInterest, borrow] = await Promise.all([
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

      let direction = deriveDirection({ shortVolRatio, shortInterestChange });

      const transition = detectRegimeTransition({
        regime,
        shortVolRatio,
        shortInterestChange,
        borrowRate,
        direction
      });

      if (transition.detected) regime = "TRANSITIONAL";

      let confidence = deriveConfidence({
        shortVolRatio,
        shortInterestChange,
        borrowRate,
        regime,
        direction
      });

      const weekly = await fetchWeeklyRegime(symbol, base);
      const resolved = resolveHierarchy({
        weekly,
        daily: { regime, direction, confidence }
      });

      regime = resolved.regime;
      direction = resolved.direction;
      confidence = resolved.confidence;

      let executionModel =
        confidence >= 80 ? "AGGRESSIVE" :
        confidence >= 60 ? "SELECTIVE" :
        confidence >= 40 ? "MEAN_REVERSION_ONLY" :
        "NO_TRADE";

      const gated = applyVolatilityGate({
        volatility,
        confidence,
        executionModel
      });

      results.push({
        symbol,
        regime,
        direction,
        confidence: gated.confidence,
        execution_model: gated.executionModel,
        horizon:
          gated.confidence >= 80 ? "SWING_ALLOWED" :
          gated.confidence >= 60 ? "INTRADAY_PRIMARY" :
          gated.confidence >= 40 ? "INTRADAY_ONLY" :
          "NO_HOLD",
        allowed_trades: deriveAllowedTrades(direction),
        regime_transition: transition,
        hierarchy: resolved,
        volatility: { vix, state: volatility, note: gated.note }
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
