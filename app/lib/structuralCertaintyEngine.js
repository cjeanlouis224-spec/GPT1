// Structural Certainty Engine
// v0.5 — 1-Week OI Anchored, Operator-First

export function computeStructuralCertainty({
  symbol,
  chainSummary,
  mode = "DAILY"
}) {
  // -----------------------------
  // HARD FAIL: No chain data
  // -----------------------------
  if (!chainSummary) {
    return {
      symbol,

      stressMap: {
        stress_side: "NEUTRAL",
        stress_location: "STRADDLED",
        distance_to_stress: "FAR",
        authority: "LOW"
      },

      openResolution: {
        open_state: "UNRESOLVED",
        interaction_with_stress: "NO",
        early_volatility: "NORMAL"
      },

      riskPermission: {
        permission: "BLOCK",
        size_cap: "MINIMAL",
        hold_cap: "NONE",
        blocked_behaviors: ["REVERSAL", "FADE", "HOLD"]
      },

      executionGate: {
        daily_alignment: "UNKNOWN",
        checklist_complete: "NO",
        allowed_setups: [],
        primary_risk: "No accessible one-week option chain",
        final_instruction: "NO_TRADE",
        data_source: "CHAIN_FETCH_FAILED"
      }
    };
  }

  // -----------------------------
  // Extract OI + Volume
  // -----------------------------
  const {
    callsTotal = 0,
    putsTotal = 0,
    callVolume = 0,
    putVolume = 0
  } = chainSummary;

  // Defensive guards
  const hasCalls = callsTotal > 0;
  const hasPuts  = putsTotal > 0;

  // -----------------------------
  // Pressure Logic (Binary)
  // -----------------------------
  const putPressure  = hasPuts  && putVolume  > putsTotal;
  const callPressure = hasCalls && callVolume > callsTotal;

  const putCovered  = hasPuts  && putsTotal  >= putVolume;
  const callCovered = hasCalls && callsTotal >= callVolume;

  // -----------------------------
  // Direction Inference (1-week)
  // -----------------------------
  let directionalPressure = "MIXED";
  let dominantSellers = "MIXED";

  if (putPressure && callPressure) {
    directionalPressure = "DOWN";
    dominantSellers = "CALL";
  } else if (putPressure && callCovered) {
    directionalPressure = "UP";
    dominantSellers = "PUT";
  } else if (putCovered && callCovered) {
    directionalPressure = "UP";
    dominantSellers = "PUT";
  }

  // -----------------------------
  // Authority Determination
  // -----------------------------
  let authority = "MEDIUM";

  if (!hasCalls && !hasPuts) {
    authority = "LOW";
  }

  // -----------------------------
  // Risk Permission Mapping
  // -----------------------------
  let permission = "LIMITED";
  let sizeCap = "REDUCED";
  let holdCap = "INTRADAY";
  let finalInstruction = "WAIT";

  if (authority === "LOW" && directionalPressure === "MIXED") {
    permission = "LIMITED";
    sizeCap = "REDUCED";
    holdCap = "INTRADAY";
    finalInstruction = "WAIT";
  }

  if (authority === "MEDIUM" && directionalPressure !== "MIXED") {
    permission = "ALLOW";
    sizeCap = "REDUCED";
    holdCap = "INTRADAY";
    finalInstruction =
      directionalPressure === "UP"
        ? "BUY_CALLS_STRUCTURAL"
        : "BUY_PUTS_STRUCTURAL";
  }

  // -----------------------------
  // Final Report
  // -----------------------------
  return {
    symbol,

    stressMap: {
      stress_side:
        directionalPressure === "UP"
          ? "UP"
          : directionalPressure === "DOWN"
          ? "DOWN"
          : "NEUTRAL",
      stress_location: "STRADDLED",
      distance_to_stress: "MID",
      authority
    },

    openResolution: {
      open_state: "UNRESOLVED",
      interaction_with_stress: "NO",
      early_volatility: "NORMAL"
    },

    riskPermission: {
      permission,
      size_cap: sizeCap,
      hold_cap: holdCap,
      blocked_behaviors:
        permission === "ALLOW"
          ? ["HOLD"]
          : ["REVERSAL", "FADE", "HOLD"]
    },

    executionGate: {
      daily_alignment:
        directionalPressure === "MIXED" ? "MIXED" : "ALIGNED",
      checklist_complete: "NO",
      allowed_setups: [],
      primary_risk:
        directionalPressure === "MIXED"
          ? "Two-sided pressure; forced moves unlikely"
          : "Early positioning before dealer covering",
      final_instruction: finalInstruction,
      data_source: "CHAIN_SUMMARY"
    },

    oiContext: {
      calls_oi: callsTotal,
      puts_oi: putsTotal,
      call_volume: callVolume,
      put_volume: putVolume,
      put_pressure: putPressure ? "YES" : "NO",
      call_pressure: callPressure ? "YES" : "NO",
      dominant_sellers: dominantSellers
    }
  };
}
