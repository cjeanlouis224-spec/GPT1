import { NextResponse } from "next/server";

import { fetchChainSummary } from "../../../lib/fetchChainSummary";
import { fetchExchangeVolume } from "../../../lib/fetchExchangeVolume";
import { structuralCertaintyEngine } from "../../../lib/structuralCertaintyEngine";

/**
 * GET /api/structural-certainty/bias?symbol=IWM
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "").toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "symbol query param required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.CHARTEXCHANGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CHARTEXCHANGE_API_KEY env var" },
        { status: 500 }
      );
    }

    const chain = await fetchChainSummary(
      symbol,
      undefined, // DAILY does not require expiration
      apiKey
    );

    const volume = await fetchExchangeVolume(
      symbol,
      apiKey
    );

    const { bias, invalidation } =
      structuralCertaintyEngine({ chain, volume });

    return NextResponse.json({
      symbol,
      timeframe: "DAILY",
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
