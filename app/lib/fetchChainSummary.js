export async function fetchChainSummary(symbol, expiration, apiKey) {
  if (!apiKey) {
    throw new Error("Missing ChartExchange API key");
  }

  const url =
    `https://chartexchange.com/api/v1/data/options/chain-summary/` +
    `?underlying=US:${symbol}` +
    (expiration ? `&expiration=${expiration}` : "") +
    `&format=json` +
    `&api_key=${apiKey}`;

  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    throw new Error(`Chain summary HTTP ${r.status} for ${symbol}`);
  }

  const data = await r.json();

  if (!Array.isArray(data) || data.length === 0) {
    // 🔒 NORMALIZED EMPTY RESULT
    return {
      totalCallOI: 0,
      totalPutOI: 0,
      callOIDelta: 0,
      putOIDelta: 0,
      dealerGamma: 0
    };
  }

  const row = data[0];

  // 🔒 HARD NORMALIZATION LAYER
  return {
    totalCallOI: Number(row.call_open_interest ?? 0),
    totalPutOI: Number(row.put_open_interest ?? 0),
    callOIDelta: Number(row.call_open_interest_change ?? 0),
    putOIDelta: Number(row.put_open_interest_change ?? 0),
    dealerGamma: Number(row.dealer_gamma ?? 0)
  };
}
