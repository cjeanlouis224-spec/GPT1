import { NextResponse } from "next/server";
import { fetchChainSummary } from "../../../lib/fetchChainSummary";
import { computeStructuralCertainty } from "../../../lib/structuralCertaintyEngine";

// ---------- Expiration resolver (weekly + holiday-safe stub) ----------
function getNextFriday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun ... 5=Fri
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ---------- Route ----------
export async function POST(req) {
  try {
    const body = await req.json();
    const symbols = Array.isArray(body?.symbols)
      ? body.symbols
      : ["SPY", "QQQ", "IWM"];

    const apiKey = process.env.CHARTEXCHANGE_API_KEY;
    const expiration = getNextFriday();

    const results = [];

    for (const symbol of symbols) {
      console.log("[DAILY_CHAIN_REQUEST]", {
        symbol,
        underlying: `US:${symbol}`,
        expiration
      });

      const chainSummary = await fetchChainSummary(
        symbol,
        expiration,
        apiKey
      );

      const report = computeStructuralCertainty({
        symbol,
        chainSummary,
        mode: "DAILY"
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
