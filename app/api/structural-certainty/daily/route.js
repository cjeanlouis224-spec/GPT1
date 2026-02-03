import { NextResponse } from "next/server";
import { fetchChainSummary } from "@/lib/fetchChainSummary";
import { runStructuralCertainty } from "@/lib/structuralCertaintyEngine";

function getNextFriday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(req) {
  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { error: "symbols array required" },
        { status: 400 }
      );
    }

    const expiration = getNextFriday();

    console.log("[DAILY_CHAIN_REQUEST]", {
  symbol,
  underlying: `US:${symbol}`,
  expiration,
});
    const apiKey = process.env.CHARTEXCHANGE_API_KEY;

    const results = [];

    for (const symbol of symbols) {
      const chainSummary = await fetchChainSummary({
        symbol,
        expiration,
        apiKey
      });

      const report = runStructuralCertainty({
        symbol,
        expiration,
        chainSummary
      });

      results.push(report);
    }

    return NextResponse.json({
      mode: "REPORT",
      expiration,
      symbols,
      results
    });

  } catch (err) {
    console.error("[DAILY_ROUTE_ERROR]", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
