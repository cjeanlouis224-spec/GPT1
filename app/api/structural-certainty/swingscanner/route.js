import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { symbol } = await req.json();

    if (!symbol) {
      return NextResponse.json(
        { error: "symbol_required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.CHARTEXCHANGE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "missing_api_key" },
        { status: 500 }
      );
    }

    const url =
      `https://chartexchange.com/api/data/options/chain-summary/` +
      `?symbol=${symbol}&format=json&api_key=${apiKey}`;

    const r = await fetch(url, { cache: "no-store" });

    if (!r.ok) {
      return NextResponse.json(
        { error: "data_unavailable" },
        { status: 502 }
      );
    }

    const data = await r.json();

    return NextResponse.json({
      symbol,
      chainSummary: data
    });

  } catch (err) {
    return NextResponse.json(
      { error: "server_error", detail: err.message },
      { status: 500 }
    );
  }
}
