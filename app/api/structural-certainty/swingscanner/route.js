export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400 }
    );
  }

  const { symbols } = body ?? {};

  if (!Array.isArray(symbols) || symbols.length === 0) {
    return Response.json(
      { error: "symbols_required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.CHARTEXCHANGE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "missing_api_key" },
      { status: 500 }
    );
  }

  const results = [];

  for (const symbol of symbols) {
    try {
      const url =
 const url =
  `https://chartexchange.com/api/v1/data/options/max-pain/` +
  `?symbol=${symbol}&format=json&api_key=${apiKey}`;

      const res = await fetch(url);

      if (!res.ok) {
        results.push({
          symbol,
          error: "chart_exchange_failed"
        });
        continue;
      }

      const data = await res.json();

      results.push({
        symbol,
        chain_summary: data
      });
    } catch {
      results.push({
        symbol,
        error: "fetch_exception"
      });
    }
  }

  if (results.every(r => r.error)) {
    return Response.json(
      { error: "data_unavailable" },
      { status: 503 }
    );
  }

  return Response.json({
    mode: "swing",
    results
  });
}
