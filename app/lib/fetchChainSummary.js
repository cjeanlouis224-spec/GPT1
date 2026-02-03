export async function fetchChainSummary(symbol, expiration, apiKey) {
  if (!apiKey) return null;
  if (!expiration) return null;

  const url =
    `https://chartexchange.com/api/v1/data/options/chain-summary/` +
    `?underlying=US:${symbol}` +
    `&expiration=${expiration}` +
    `&format=json` +
    `&api_key=${apiKey}`;

  console.log("[CHAIN_SUMMARY_REQUEST]", {
    symbol,
    underlying: `US:${symbol}`,
    expiration,
    url
  });

  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    console.error("[CHAIN_SUMMARY_HTTP_ERROR]", r.status);
    return null;
  }

  const data = await r.json();

  if (!Array.isArray(data) || data.length === 0) {
    console.warn("[CHAIN_SUMMARY_EMPTY]", symbol, expiration);
    return null;
  }

  console.log("[CHAIN_SUMMARY_OK]", Object.keys(data[0]));
  return data[0];
}
