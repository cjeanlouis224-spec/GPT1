import { NextResponse } from "next/server";

const DEFAULT_SYMBOLS = ["SPY", "QQQ", "IWM"];

export async function POST(req) {
  let symbols = DEFAULT_SYMBOLS;

  try {
    const body = await req.json();
    if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
      symbols = body.symbols;
    }
  } catch (_) {
    // ignore malformed body
  }

  const apiKey = process.env.CHARTEXCHANGE_API_KEY;

  // --- Deterministic fallback ---
  const fallback = {
    regimeTable: symbols.map((s) => ({
      symbol: s,
      regime: "BEAR_CONTROLLED",
      pc_ratio: null,
      calls_total: null,
      puts_total: null,
      max_pain: null,
    })),
    directionGate: Object.fromEntries(
      symbols.map((s) => [s, "SHORT_BIAS_INTRADAY"])
    ),
    executionMode: "SHORT_SCALPS_FAVORED",
    allowedTrades: [
      "Short failed pops into VWAP or prior high",
      "Sell call-side rips; avoid chasing breakdowns",
      "Favor downside momentum after weak bounces",
      "Cover partials quickly at intraday supports",
    ],
    primaryRisk: "Sharp bear-market rallies squeezing shorts",
    status: "DETERMINISTIC_FALLBACK",
  };

  // --- Try ChartExchange (optional enhancement) ---
  if (!apiKey) {
    return NextResponse.json(fallback);
  }

  try {
    const enriched = [];

    for (const symbol of symbols) {
      const url =
        `https://chartexchange.com/api/v1/data/options/chain-summary/` +
        `?symbol=${symbol}&format=json&api_key=${apiKey}`;

      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("bad response");

      const data = await r.json();
      const row = data?.[0] ?? {};

      enriched.push({
        symbol,
        regime: "BEAR_CONTROLLED",
        pc_ratio: row.putCallRatio ?? null,
        calls_total: row.callsTotal ?? null,
        puts_total: row.putsTotal ?? null,
        max_pain: row.maxPain ?? null,
      });
    }

    return NextResponse.json({
      ...fallback,
      regimeTable: enriched,
      status: "LIVE_DATA",
    });
  } catch (_) {
    return NextResponse.json(fallback);
  }
}
