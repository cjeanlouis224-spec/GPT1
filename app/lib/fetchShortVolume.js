export async function fetchShortVolume(symbol) {
  const url =
    `https://chartexchange.com/api/v1/data/stocks/short-volume/` +
    `?symbol=${symbol}&api_key=${process.env.CHARTEXCHANGE_API_KEY}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error("Short volume fetch failed");

  const data = await r.json();
  const row = data?.[0];
  if (!row) return null;

  const shortVol = Number(row.short_volume);
  const totalVol = Number(row.total_volume);

  return {
    shortVolume: shortVol,
    totalVolume: totalVol,
    shortPct: totalVol > 0 ? shortVol / totalVol : null
  };
}
