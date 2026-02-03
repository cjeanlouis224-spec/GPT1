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

  let chain, volume;

  try {
    chain = await fetchChainSummary(symbol);
  } catch (e) {
    return NextResponse.json(
      { error: "fetchChainSummary failed", symbol, detail: e.message },
      { status: 500 }
    );
  }

  try {
    volume = await fetchExchangeVolume(symbol);
  } catch (e) {
    return NextResponse.json(
      { error: "fetchExchangeVolume failed", symbol, detail: e.message },
      { status: 500 }
    );
  }

  if (!chain) {
    return NextResponse.json(
      { error: "chain data missing", symbol },
      { status: 500 }
    );
  }

  if (!volume) {
    return NextResponse.json(
      { error: "volume data missing", symbol },
      { status: 500 }
    );
  }

  let result;
  try {
    result = structuralCertaintyEngine({ chain, volume });
  } catch (e) {
    return NextResponse.json(
      {
        error: "engine failure",
        symbol,
        detail: e.message,
        chainKeys: Object.keys(chain || {}),
        volumeKeys: Object.keys(volume || {})
      },
      { status: 500 }
    );
  }

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
