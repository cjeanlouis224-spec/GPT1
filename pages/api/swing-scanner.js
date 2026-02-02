// pages/api/swing-scanner.js

/* ======================================================
   UTILITIES
====================================================== */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ======================================================
   ELIGIBILITY GATES
====================================================== */

function isBullishEligible(d) {
  return (
    d.short_volume_ratio < 0.45 &&
    d.short_interest_change < 0 &&
    d.regime !== "TRANSITION"
  );
}

function isBearishEligible(d) {
  return (
    d.short_volume_ratio > 0.55 &&
    d.short_interest_change > 0 &&
    d.regime !== "TRANSITION"
  );
}

/* ======================================================
   SCORING MODELS (0–100)
====================================================== */

function bullishScore(d) {
  let s = 0;

  // Short interest covering (0–30)
  s += clamp(Math.abs(d.short_interest_change) * 300, 0, 30);

  // Short volume pressure (0–20)
  if (d.short_volume_ratio < 0.45) s += 20;

  // Borrow pressure (0–15)
  if (d.borrow_rate >= 8) s += 15;
  else if (d.borrow_rate >= 4) s += 8;

  // Options gravity (0–10)
  if (d.options?.max_pain_distance_pct != null) {
    if (d.options.max_pain_distance_pct <= 2) s += 10;
    else if (d.options.max_pain_distance_pct <= 4) s += 5;
  }

  // ITM skew (0–10)
  if (d.options?.itm_call_put_ratio != null) {
    if (d.options.itm_call_put_ratio >= 1.2) s += 10;
    else if (d.options.itm_call_put_ratio >= 1.05) s += 5;
  }

  // Regime boost (0–15)
  if (d.regime === "ACCUMULATION") s += 15;
  else if (d.regime === "EXPANSION") s += 8;

  return clamp(Math.round(s), 0, 100);
}

function bearishScore(d) {
  let s = 0;

  // Short interest expansion (0–30)
  s += clamp(Math.abs(d.short_interest_change) * 300, 0, 30);

  // Short volume pressure (0–20)
  if (d.short_volume_ratio > 0.55) s += 20;

  // Borrow ease (0–15)
  if (d.borrow_rate <= 5) s += 15;
  else if (d.borrow_rate <= 8) s += 8;

  // Options gravity (0–10)
  if (d.options?.max_pain_distance_pct != null) {
    if (d.options.max_pain_distance_pct <= 2) s += 10;
    else if (d.options.max_pain_distance_pct <= 4) s += 5;
  }

  // ITM skew (0–10)
  if (d.options?.itm_call_put_ratio != null) {
    if (d.options.itm_call_put_ratio <= 0.85) s += 10;
    else if (d.options.itm_call_put_ratio <= 0.95) s += 5;
  }

  // Regime boost (0–15)
  if (d.regime === "DISTRIBUTION") s += 15;
  else if (d.regime === "EXHAUSTION") s += 8;

  return clamp(Math.round(s), 0, 100);
}

/* ======================================================
   RANKING HELPERS
====================================================== */

function confidenceFromScore(score) {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function horizonFromScore(score) {
  if (score >= 80) return "7–15";
  if (score >= 60) return "5–10";
  return "3–7";
}

function bullishDriver(d) {
  if (d.borrow_rate >= 8) return "BORROW_CONSTRAINT";
  if (d.short_interest_change < 0) return "SHORT_COVERING";
  return "POSITIONING_IMBALANCE";
}

function bearishDriver(d) {
  if (d.short_interest_change > 0 && d.borrow_rate <= 5) return "SHORT_RELOAD";
  if (d.options?.max_pain_distance_pct <= 2) return "OPTIONS_GRAVITY";
  return "LONG_UNWIND";
}

/* ======================================================
   API HANDLER
====================================================== */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST required" });
    }

    const body = req.body || {};
    const scan_date = body.scan_date || todayISO();
    const universe = body.universe;
    const data = body.data;
    const constraints = body.constraints || {};

    if (!universe || !Array.isArray(universe.symbols) || !Array.isArray(data)) {
      return res.status(400).json({
        error: "Invalid payload",
        required: ["universe.symbols", "data[]"]
      });
    }

    const maxBull = constraints.max_bullish ?? 5;
    const maxBear = constraints.max_bearish ?? 5;
    const minConf = constraints.min_confidence ?? "MEDIUM";

    // ---- Filter eligible
    const bulls = data.filter(isBullishEligible);
    const bears = data.filter(isBearishEligible);

    // ---- Score
    const scoredBulls = bulls
      .map(d => {
        const score = bullishScore(d);
        return {
          symbol: d.symbol,
          score,
          regime: d.regime,
          pressure_driver: bullishDriver(d),
          time_horizon_days: horizonFromScore(score),
          confidence: confidenceFromScore(score)
        };
      })
      .filter(x => x.confidence !== "LOW" || minConf === "LOW");

    const scoredBears = bears
      .map(d => {
        const score = bearishScore(d);
        return {
          symbol: d.symbol,
          score,
          regime: d.regime,
          pressure_driver: bearishDriver(d),
          time_horizon_days: horizonFromScore(score),
          confidence: confidenceFromScore(score)
        };
      })
      .filter(x => x.confidence !== "LOW" || minConf === "LOW");

    // ---- Rank
    scoredBulls.sort((a, b) => b.score - a.score);
    scoredBears.sort((a, b) => b.score - a.score);

    const bullish_swings = scoredBulls.slice(0, maxBull).map((x, i) => ({
      rank: i + 1,
      symbol: x.symbol,
      regime: x.regime,
      pressure_driver: x.pressure_driver,
      time_horizon_days: x.time_horizon_days,
      confidence: x.confidence
    }));

    const bearish_swings = scoredBears.slice(0, maxBear).map((x, i) => ({
      rank: i + 1,
      symbol: x.symbol,
      regime: x.regime,
      pressure_driver: x.pressure_driver,
      time_horizon_days: x.time_horizon_days,
      confidence: x.confidence
    }));

    return res.status(200).json({
      scan_date,
      universe,
      bullish_swings,
      bearish_swings,
      notes: [
        "Symbols omitted if structural balance detected",
        "Ranking reflects forced resolution, not trend strength"
      ]
    });
  } catch (err) {
    return res.status(500).json({
      error: "Swing scanner failed",
      detail: err.message
         export default function handler(req, res) {
  res.status(200).json({ ok: true });
}
    });
  }
}
