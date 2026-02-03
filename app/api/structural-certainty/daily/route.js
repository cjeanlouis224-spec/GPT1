import { NextResponse } from "next/server";

import { fetchChainSummary } from "../../../lib/fetchChainSummary";
import { fetchExchangeVolume } from "../../../lib/fetchExchangeVolume";
import { structuralCertaintyEngine } from "../../../lib/structuralCertaintyEngine";

/**
 * POST /api/structural-certainty/daily
 * Body: { "symbols": ["IWM", "SPY", "QQQ"] }
 */
export async function POST(req) {
  try {
    // -----------------------------
    // Parse request body
    // -----------------------------
    const body = await req.json();
    const symbols = body?.symbols;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "symbols array required" },
        { status: 400 }
      );
    }

    // -----------------------------
    // ENV VAR CHECK (PUT IT HERE)
    // -----------------------------
    const apiKey = process.env.CHARTEXCHANGE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CHARTEXCHANGE_API_KEY env var" },
        { status: 500 }
      );
    }

    const results = {};

    // -----------------------------
    // Per-symbol processing
    // -----------------------------
    for (const rawSymbol of symbols) {
      const symbol = rawSymbol.toUpperCase();

      // ---- Fetch normalized inputs ----
      const chain = await fetchChainSummary(
        symbol,
        undefined, // DAILY does not depend on expiration
        apiKey
      );

      const volume = await fetchExchangeVolume(
        symbol,
        apiKey
      );

      // ---- Run engine ----
      const result = structuralCertaintyEngine({ chain, volume });

      results[symbol] = {
        timeframe: "DAILY",
        bias: result.bias,
        invalidation: result.invalidation
      };
    }

    // -----------------------------
    // Return batch result
    // -----------------------------
    return NextResponse.json(results);

  } catch (err) {
    console.error("dailyCheck POST error:", err);

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
