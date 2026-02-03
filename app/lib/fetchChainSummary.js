/**
 * fetchChainSummary
 *
 * ChartExchange requires:
 * - underlying
 * - expiration
 */

function resolveNearestFriday() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun ... 5=Fri
  let daysToFriday = (5 - day + 7) % 7;
  if (daysToFriday === 0) daysToFriday = 7;

  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() + daysToFriday);
  return friday.toISOString().slice(0, 10);
}

export async function fetchChainSummary(symbol, apiKey) {
  if (!symbol) throw new Error("Missing symbol");
  if (!apiKey) throw new Error("Missing CHARTEXCHANGE_API_KEY");

  const expiration = resolveNearestFriday();

  const url =
    "https://chartexchange.com/api/v1/data/options/chain-summary/" +
    `?underlying=US:${symbol}` +
    `&expiration=${expiration}` +
    "&format=json" +
    `&api_key=${apiKey}`;

  console.log("[CHAIN_SUMMARY_REQUEST]", { symbol, expiration, url });

  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    const text = await r.text();
    console.error("[CHAIN_SUMMARY_HTTP_ERROR]", r.status, text);
    throw new Error(`Chain summary HTTP ${r.status} for ${symbol}`);
  }

  const data = await r.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Empty chain summary for ${symbol}`);
  }

  return data[0];
}
