// pages/api/structural-certainty/swing-scanner.jS

/* =========================
   HELPERS
========================= */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* =========================
   ELIGIBILITY
========================= */

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

/* =========================
   SCORING
========================= */

function bullishScore(d) {
  let s = 0;

  s += clamp(Math.abs(d.short_interest_change) * 300, 0, 30);

  if (d.short_volume_ratio < 0.45) s += 20;

  if (d.borrow_rate >= 8) s += 15;
  else if (d.borrow_rate >= 4) s += 8;

  if (d.options?.max_pain_distance_pct != null) {
    if (d.options.max_pain_distance_pct <= 2) s += 10;
    else if (d.options.max_pain_distance_pct <= 4) s += 5;
  }

  if (d.options?.itm_call_put_ratio != null) {
    if (d.options.itm_call_put_ratio >= 1.2) s += 10;
    else if (d.options.itm_call_put_ratio >= 1.05) s += 5;
  }

  if (d.regime === "ACCUMULATION") s += 15;
  else if (d.regime === "EXPANSION") s += 8;

  return clamp(Math.round(s), 0, 100);
}

function bearishScore(d) {
  let s = 0;

  s += clamp(Math.abs(d.short_interest_change) * 300, 0, 30);

  if (d.short_volume_ratio > 0.55) s += 20;

  if (d.borrow_rate <= 5) s += 15;
  else if (d.borrow_rate <= 8) s += 8;

  if (d.options?.max_pain_distance_pct != null) {
    if (d.options.max_pain_distance_pct <= 2) s += 10;
    else if (d.options.max_pain_distance_pct <= 4) s += 5;
  }

  if (d.options?.itm_call_put_ratio != null) {
    if (d.options.itm_call_put_ratio <= 0.85) s += 10;
    else if (d.options.itm_call_put_ratio <= 0.95) s += 5;
  }

  if (d.regime === "DISTRIBUTION") s += 15;
  else if (d.regime === "EXHAUSTION") s += 8;

  return clamp(Math.round(s), 0, 100);
}

/* =========================
   LABELS
========================= */

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

/* =========================
   API HANDLER (ONLY EXPORT)
========================= */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
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

    if (!universe || !Array.isArray(universe.symbols)) {
      return res.status(400).json({ error: "Missing universe.symbols" });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "No data rows provided" });
    }

    const maxBull = constraints.max_bullish ?? 5;
    const maxBear = constraints.max_bearish ?? 5;
    const minConf = constraints.min_confidence ?? "MEDIUM";

    const bullish = data
      .filter(isBullishEligible)
      .map(d => {
        const score = bullishScore(d);
        const confidence = confidenceFromScore(score);
        if (confidence === "LOW" && minConf !== "LOW") return null;
        return {
          symbol: d.symbol,
          score,
          regime: d.regime,
          pressure_driver: bullishDriver(d),
          time_horizon_days: horizonFromScore(score),
          confidence
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxBull)
      .map((x, i) => ({ rank: i + 1, ...x }));

    const bearish = data
      .filter(isBearishEligible)
      .map(d => {
        const score = bearishScore(d);
        const confidence = confidenceFromScore(score);
        if (confidence === "LOW" && minConf !== "LOW") return null;
        return {
          symbol: d.symbol,
          score,
          regime: d.regime,
          pressure_driver: bearishDriver(d),
          time_horizon_days: horizonFromScore(score),
          confidence
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxBear)
      .map((x, i) => ({ rank: i + 1, ...x }));

    return res.status(200).json({
      scan_date,
      universe,
      bullish_swings: bullish,
      bearish_swings: bearish,
      notes: [
        "Structural imbalance required for inclusion",
        "Rank reflects forced resolution, not trend strength"
      ]
    });

  } catch (err) {
    return res.status(500).json({
      error: "Swing scanner failed",
      detail: err.message
    });
  }
}
