export async function POST(req) {
  const body = await req.json();
  const symbol = body?.symbol;

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol required" },
      { status: 400 }
    );
  }

  const chain = await fetchChainSummary(symbol.toUpperCase());
  const volume = await fetchExchangeVolume(symbol.toUpperCase());

  const { bias, invalidation } =
    structuralCertaintyEngine({ chain, volume });

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    timeframe: "DAILY",
    bias,
    invalidation
  });
}
