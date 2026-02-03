export async function POST(req) {
  const body = await req.json();
  const symbol = body?.symbol;

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.kgpkbt701a7d69thx302r55iyzetqdkn;

if (!apiKey) {
  return NextResponse.json(
    { error: "Missing CHARTEXCHANGE_API_KEY env var" },
    { status: 500 }
  );
}

const chain = await fetchChainSummary(symbol, undefined, apiKey);
const volume = await fetchExchangeVolume(symbol, apiKey);
  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    timeframe: "DAILY",
    bias,
    invalidation
  });
}
