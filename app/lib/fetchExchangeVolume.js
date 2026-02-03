export async function fetchExchangeVolume(symbol, apiKey) {
  const url =
    `https://chartexchange.com/api/v1/data/stocks/exchange-volume/` +
    `?symbol=US:${symbol}&format=json&api_key=${apiKey}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;

  const data = await r.json();
  return data ?? null;
}
