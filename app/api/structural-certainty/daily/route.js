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
    const body = await req.json();
    const symbols = body?.symbols;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "symbols array required" },
        { status: 400 }
      );
    }

    const results = {};

    for (const rawSymbol of symbols) {
      const symbol = rawSymbol.toUpperCase();

      const chain = await fetchChainSummary(symbol);
      const volume = await fetchExchangeVolume(symbol);

      const result = structuralCertaintyEngine({ chain, volume });

      results[symbol] = {
        timeframe: "DAILY",
        bias: result.bias,
        invalidation: result.invalidation
      };
    }

    return NextResponse.json(results);

  } catch (err) {
    console.error("dailyCheck POST error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
