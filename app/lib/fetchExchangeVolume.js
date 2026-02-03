export async function fetchExchangeVolume(symbol, apiKey) {
  if (!apiKey) {
    throw new Error("Missing ChartExchange API key");
  }

  const url =
    `https://chartexchange.com/api/v1/data/stocks/exchange-volume/` +
    `?symbol=US:${symbol}` +
    `&format=json` +
    `&api_key=${apiKey}`;

  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    throw new Error(`Exchange volume HTTP ${r.status} for ${symbol}`);
  }

  const data = await r.json();

  return {
    todayVolume: Number(data?.today_volume ?? 0),
    avg20Volume: Number(data?.avg_20_day_volume ?? 0)
  };
}
