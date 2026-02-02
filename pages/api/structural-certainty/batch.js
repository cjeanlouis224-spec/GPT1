export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;

  // Turbopack safety
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const { symbols } = body || {};

  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({
      error: "Missing or invalid symbols parameter",
      example: { symbols: ["IWM", "SPY", "QQQ"] }
    });
  }

  const data = symbols.map(symbol => ({
    symbol,
    regime: "BALANCED",
    direction: "NEUTRAL",
    confidence: 50,
    allowed_trades: ["mean_reversion"]
  }));

  return res.status(200).json({
    ok: true,
    count: data.length,
    data
  });
}
