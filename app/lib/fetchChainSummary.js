export async function fetchChainSummary(symbol, apiKey) {
  const url =
    `https://chartexchange.com/api/v1/data/options/chain-summary/` +
    `?symbol=${symbol}&format=json&api_key=${apiKey}`;

  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    console.log("[FETCH_CHAIN_SUMMARY] HTTP FAIL", symbol, r.status);
    return null;
  }

  const data = await r.json();

  console.log("[FETCH_CHAIN_SUMMARY] RAW", symbol, data);

  if (!Array.isArray(data) || data.length === 0) {
    console.log("[FETCH_CHAIN_SUMMARY] EMPTY", symbol);
    return null;
  }

  const row = data[0];

  // Do NOT over-filter — allow partial rows
  if (
    row.callsTotal == null &&
    row.putsTotal == null &&
    row.maxPain == null
  ) {
    console.log("[FETCH_CHAIN_SUMMARY] NO USABLE FIELDS", symbol, row);
    return null;
  }

  console.log("[FETCH_CHAIN_SUMMARY] LIVE", symbol, {
    callsTotal: row.callsTotal,
    putsTotal: row.putsTotal,
    maxPain: row.maxPain,
  });

  return row;
}
