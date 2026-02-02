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

  const { universe, min_confidence = "MEDIUM" } = body || {};

  if (!Array.isArray(universe) || universe.length === 0) {
    return res.status(400).json({
      error: "Missing or invalid universe parameter",
      example: { universe: ["IWM", "SPY", "QQQ"] }
    });
  }

  const setups = universe.map(symbol => ({
    symbol,
    bias: "NONE",
    confidence: min_confidence,
    window: "N/A"
  }));

  return res.status(200).json({
    ok: true,
    count: setups.length,
    setups
  });
}
