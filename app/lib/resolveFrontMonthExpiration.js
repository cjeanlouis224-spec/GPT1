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

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error("[EXPIRATIONS_EMPTY_OR_INVALID]", data);
    return null;
  }

  // Normalize expiration dates from multiple possible formats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expirations = data
    .map(item => {
      if (typeof item === "string") return item;
      if (item.expiration) return item.expiration;
      if (item.expiration_date) return item.expiration_date;
      if (item.date) return item.date;
      return null;
    })
    .filter(Boolean)
    .filter(dateStr => {
      const d = new Date(dateStr);
      return !isNaN(d) && d >= today;
    })
    .sort((a, b) => new Date(a) - new Date(b));

  if (expirations.length === 0) {
    console.error("[EXPIRATIONS_NO_FUTURE_DATES]", data);
    return null;
  }

  return expirations[0];
}
