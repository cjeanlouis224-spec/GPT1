export async function fetchOptionExpirations(symbol, apiKey) {
  const url =
    `https://chartexchange.com/api/v1/data/options/expirations/` +
    `?underlying=US:${symbol}&format=json&api_key=${apiKey}`;

  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    throw new Error(`Expiration fetch failed for ${symbol}`);
  }

  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
