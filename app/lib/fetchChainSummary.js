/**
 * fetchChainSummary
 *
 * Uses ChartExchange:
 *   /api/v1/data/options/chain-summary
 *
 * IMPORTANT:
 * - Do NOT pass expiration
 * - This endpoint implicitly returns the nearest active expiration
 * - This matches your available API access
 */

export async function fetchChainSummary(symbol, apiKey) {
  if (!symbol) {
    throw new Error("fetchChainSummary: missing symbol");
  }

  if (!apiKey) {
    throw new Error("fetchChainSummary: missing CHARTEXCHANGE_API_KEY");
  }

  const url =
    "https://chartexchange.com/api/v1/data/options/chain-summary/" +
    `?underlying=US:${symbol}` +
    "&format=json" +
    `&api_key=${apiKey}`;

  console.log("[CHAIN_SUMMARY_REQUEST]", {
    symbol,
    underlying: `US:${symbol}`
  });

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    console.error(
      "[CHAIN_SUMMARY_HTTP_ERROR]",
      symbol,
      response.status
    );
    throw new Error(
      `Chain summary HTTP ${response.status} for ${symbol}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    console.error("[CHAIN_SUMMARY_EMPTY]", symbol, data);
    throw new Error(`Empty chain summary for ${symbol}`);
  }

  const row = data[0];

  // Minimal shape validation (defensive, not strict)
  if (
    row.pc_ratio === undefined ||
    row.calls_total === undefined ||
    row.puts_total === undefined
  ) {
    console.error("[CHAIN_SUMMARY_INVALID_SHAPE]", row);
    throw new Error(`Invalid chain summary shape for ${symbol}`);
  }

  console.log("[CHAIN_SUMMARY_OK]", {
    symbol,
    pc_ratio: row.pc_ratio,
    calls_total: row.calls_total,
    puts_total: row.puts_total,
    itm_calls: row.itm_calls,
    itm_puts: row.itm_puts,
    max_pain: row.max_pain
  });

  return row;
}
