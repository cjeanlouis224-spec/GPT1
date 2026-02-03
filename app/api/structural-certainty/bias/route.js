import { NextResponse } from "next/server";

import { fetchChainSummary } from "../../../lib/fetchChainSummary";
import { fetchExchangeVolume } from "../../../lib/fetchExchangeVolume";
import { structuralCertaintyEngine } from "../../../lib/structuralCertaintyEngine";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "").toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "symbol required" },
        { status: 400 }
      );
    }

    const chain = await fetchChainSummary(symbol);
    const volume = await fetchExchangeVolume(symbol);

    const { bias, invalidation } =
      structuralCertaintyEngine({ chain, volume });

    return NextResponse.json({
      symbol,
      timeframe: "DAILY",
      bias,
      invalidation
    });

  } catch (err) {
    console.error("Bias route error:", err);
    return NextResponse.json(
      { error: "Bias evaluation failed" },
      { status: 500 }
    );
  }
}
