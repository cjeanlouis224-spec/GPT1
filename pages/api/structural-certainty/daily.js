// pages/api/structural-certainty/daily.js

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${url}`);
  return r.json();
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

/* =========================
   STRUCTURAL DERIVATIONS
========================= */

function deriveDirection({ pc_ratio, calls_total, puts_total }) {
  if (pc_ratio >= 1.5 && puts_total > calls_total) return "DOWN";
  if (pc_ratio <= 0.7 && calls_total > puts_total) return "UP";
  return "NEUTRAL";
}

function deriveRegime({ pc_ratio }) {
  if (pc_ratio >= 1.5) return "BEAR_CONTROLLED";
  if (pc_ratio <= 0.7) return "BULL_CONTROLLED";
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
   API HANDLER
========================= */

export default async function handler(req, res) {
  try {
    const symbol = (req.query.symbol || "").toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol" });
    }

    // INTERNAL API BASE (DO NOT CHANGE)
    const base = `https://${req.headers.host}/api/cex`;

    // Pull required raw data
    const chain = await fetchJSON(
      `${base}/chain-summary?symbol=${symbol}`
    );

    const {
      pc_ratio = 1,
      calls_total = 0,
      puts_total = 0,
      max_pain = null
    } = chain || {};

    // Structural derivations
    const direction = deriveDirection({ pc_ratio, calls_total, puts_total });
    const regime = deriveRegime({ pc_ratio });
    const directionGate = deriveDirectionGate(direction);
    const executionMode = deriveExecutionMode({ regime, direction });
    const allowedTrades = deriveAllowedTrades(direction);

    // Final response
    return res.status(200).json({
      symbol,
      date: new Date().toISOString().slice(0, 10),
      marketStatus: "closed",

      A_regime: {
        regime,
        direction,
        pc_ratio,
        calls_total,
        puts_total,
        max_pain
      },

      B_direction_gate: directionGate,

      C_execution_mode: executionMode,

      D_allowed_trades: allowedTrades,

      summary: {
        structural_direction: direction,
        primary_risk:
          direction === "DOWN"
            ? "Sharp bear-market rallies squeezing shorts"
            : direction === "UP"
            ? "Fast downside reversals after long positioning"
            : "False breakouts in low-certainty regime"
      }
    });
  } catch (err) {
    return res.status(500).json({
      error: "Structural Certainty failed",
      detail: err.message
    });
  }
}
