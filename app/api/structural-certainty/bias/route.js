import { NextResponse } from "next/server";

import { fetchChainSummary } from "@/app/lib/fetchChainSummary";
import { fetchExchangeVolume } from "@/app/lib/fetchExchangeVolume";
import { structuralCertaintyEngine } from "@/app/lib/structuralCertaintyEngine";

/**
 * GET /api/structural-certainty/bias?symbol=IWM
 *
 * Returns ONLY directional bias.
 * No trade ideas. No execution logic. No narration.
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

    // --- Fetch raw inputs ---
    const chainSummary = await fetchChainSummary(symbol);
    const exchangeVolume = await fetchExchangeVolume(symbol);

    if (!chainSummary || !exchangeVolume) {
      return NextResponse.json(
        { error: "Missing market data" },
        { status: 502 }
      );
    }

    // --- Run structural engine ---
    const result = structuralCertaintyEngine({
      chain: chainSummary,
      volume: exchangeVolume
    });

    // --- Hard validation (do not allow partials) ---
    if (
      !result?.bias?.direction ||
      typeof result.bias.confidence !== "number"
    ) {
      throw new Error("Invalid bias object returned from engine");
    }

    // --- Return ONLY bias envelope ---
    return NextResponse.json({
      symbol,
      timeframe: "DAILY",
      bias: {
        direction: result.bias.direction,
        confidence: Number(result.bias.confidence.toFixed(2)),
        drivers: result.bias.drivers
      },
      invalidation: result.invalidation
    });

  } catch (err) {
    console.error("Bias route error:", err);

    return NextResponse.json(
      { error: "Bias evaluation failed" },
      { status: 500 }
    );
  }
}
