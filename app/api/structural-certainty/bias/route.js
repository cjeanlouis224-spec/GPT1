import { NextResponse } from "next/server";

import { fetchChainSummary } from "../../../lib/fetchChainSummary";
import { fetchExchangeVolume } from "../../../lib/fetchExchangeVolume";
import { fetchOptionExpirations } from "../../../lib/fetchOptionExpirations";
import { getNearestExpiration } from "../../../lib/getNearestExpiration";
import { structuralCertaintyEngine } from "../../../lib/structuralCertaintyEngine";

/**
 * GET /api/structural-certainty/bias?symbol=IWM
 *
 * Returns DAILY directional bias only.
 * No execution logic. No inference.
 */
export async function GET(req) {
  try {
    // -----------------------------
    // Parse symbol
    // -----------------------------
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "").toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "symbol query param required" },
        { status: 400 }
      );
    }

    // -----------------------------
    // Env var check
    // -----------------------------
    const apiKey = process.env.CHARTEXCHANGE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CHARTEXCHANGE_API_KEY env var" },
        { status: 500 }
      );
    }

    // -----------------------------
    // Resolve expiration (REQUIRED by ChartExchange)
    // -----------------------------
    const expirations = await fetchOptionExpirations(symbol);
    const expiration = getNearestExpiration(expirations);

    if (!expiration) {
      return NextResponse.json(
        { error: "No valid option expiration available", symbol },
        { status: 500 }
      );
    }

    // -----------------------------
    // Fetch normalized inputs
    // -----------------------------
    const chain = await fetchChainSummary(
      symbol,
      expiration,
      apiKey
    );

    const volume = await fetchExchangeVolume(
      symbol,
      apiKey
    );

    // -----------------------------
    // Run Structural Certainty Engine
    // -----------------------------
    const { bias, invalidation } =
      structuralCertaintyEngine({ chain, volume });

    // -----------------------------
    // Return bias envelope
    // -----------------------------
    return NextResponse.json({
      symbol,
      timeframe: "DAILY",
      expiration,
      bias,
      invalidation
    });

  } catch (err) {
    console.error("Bias GET error:", err);

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
