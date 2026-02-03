/**
 * Structural Certainty Engine
 * Sole authority for regime, bias, and execution mode
 */

export function structuralCertaintyEngine({ chain, volume }) {
  if (!chain || !volume) {
    throw new Error("Missing inputs to structuralCertaintyEngine");
  }

  const {
    totalCallOI,
    totalPutOI,
    callOIDelta,
    putOIDelta,
    dealerGamma
  } = chain;

  const {
    todayVolume,
    avg20Volume
  } = volume;

  // -----------------------------
  // OI dominance
  // -----------------------------
  const callDominant = totalCallOI > totalPutOI * 1.1;
  const putDominant  = totalPutOI > totalCallOI * 1.1;

  // -----------------------------
  // Volume expansion
  // -----------------------------
  const volumeExpansion = todayVolume > avg20Volume;

  // -----------------------------
  // Dealer alignment
  // -----------------------------
  const positiveDealer = dealerGamma >= 0 || putOIDelta < 0;
  const negativeDealer = dealerGamma <= 0 || callOIDelta < 0;

  let direction = "NEUTRAL";
  let drivers = [];

  if (callDominant && volumeExpansion && positiveDealer) {
    direction = "LONG_ONLY";
    drivers = [
      "CALL_OI_DOMINANCE",
      "EXCHANGE_VOLUME_EXPANSION",
      "POSITIVE_DEALER_GAMMA"
    ];
  }

  if (putDominant && volumeExpansion && negativeDealer) {
    direction = "SHORT_ONLY";
    drivers = [
      "PUT_OI_DOMINANCE",
      "EXCHANGE_VOLUME_EXPANSION",
      "NEGATIVE_DEALER_GAMMA"
    ];
  }

  // -----------------------------
  // Confidence score (0–1)
  // -----------------------------
 const oiDenom = totalCallOI + totalPutOI;
const oiStrength =
  oiDenom > 0
    ? Math.abs(totalCallOI - totalPutOI) / oiDenom
    : 0;

const volumeStrength =
  avg20Volume > 0
    ? Math.min(1, todayVolume / avg20Volume)
    : 0;

const dealerAlignment =
  direction === "LONG_ONLY"
    ? (positiveDealer ? 1 : 0)
    : direction === "SHORT_ONLY"
    ? (negativeDealer ? 1 : 0)
    : 0;

const rawConfidence =
  0.4 * oiStrength +
  0.3 * volumeStrength +
  0.3 * dealerAlignment;

const confidence = Number(
  (Number.isFinite(rawConfidence) ? rawConfidence : 0).toFixed(2)
);

  return {
    regime: volumeExpansion ? "TREND" : "RANGE",

    bias: {
      direction,
      confidence: Number(confidence.toFixed(2)),
      disallowed:
        direction === "LONG_ONLY"
          ? ["SHORT"]
          : direction === "SHORT_ONLY"
          ? ["LONG"]
          : ["LONG", "SHORT"],
      drivers
    },

    executionMode:
      direction === "NEUTRAL" ? "NO_TRADE" : "DAY",

    invalidation:
      "OI dominance flip or loss of exchange volume expansion"
  };
}
