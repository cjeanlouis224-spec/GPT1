import { NextResponse } from "next/server";
import { fetchChainSummary } from "../../../lib/fetchChainSummary";
import { fetchExchangeVolume } from "../../../lib/fetchExchangeVolume";
import { structuralCertaintyEngine } from "../../../lib/structuralCertaintyEngine";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol" },
        { status: 400 }
      );
    }

    const apiKey = process.env.CHARTEXCHANGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CHARTEXCHANGE_API_KEY" },
        { status: 500 }
      );
    }

    // --- Fetch data ---
    const chain = await fetchChainSummary(symbol, apiKey);
    const exchangeVolume = await fetchExchangeVolume(symbol, apiKey);

    // ❗ FIX: engine is async → MUST await
    const result = await structuralCertaintyEngine({
      symbol,
      chain,
      exchangeVolume
    });

    return NextResponse.json(result);

  } catch (err) {
    console.error("[DAILY_ROUTE_ERROR]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
