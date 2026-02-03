export async function resolveFrontMonthExpiration(symbol, apiKey) {
  if (!apiKey) return null;

  const url =
    `https://chartexchange.com/api/v1/data/options/expirations/` +
    `?underlying=US:${symbol}&format=json&api_key=${apiKey}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    console.error("[EXPIRATIONS_HTTP_ERROR]", r.status);
    return null;
  }

  const data = await r.json();

  if (!Array.isArray(data) || data.length === 0) {
    console.error("[EXPIRATIONS_EMPTY]", symbol);
    return null;
  }

  // Return the nearest future expiration
  const today = new Date();

  const futureExpirations = data
    .map(d => d.expiration)
    .filter(Boolean)
    .filter(dateStr => new Date(dateStr) >= today)
    .sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

  return futureExpirations[0] ?? null;
}
