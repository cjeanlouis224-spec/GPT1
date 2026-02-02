export default function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    let body = req.body;

    // Turbopack / Vercel safety
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          error: "Invalid JSON body",
        });
      }
    }

    const { universe, min_confidence = "MEDIUM" } = body || {};

    if (!Array.isArray(universe) || universe.length === 0) {
      return res.status(400).json({
        error: "Missing or invalid universe parameter",
        example: { universe: ["SPY", "QQQ", "IWM"] },
      });
    }

    const swings = universe.map((symbol) => ({
      symbol,
      setup: "NONE",
      bias: "NEUTRAL",
      timeframe: "SWING",
      confidence: min_confidence,
    }));

    return res.status(200).json({
      ok: true,
      type: "swing",
      count: swings.length,
      results: swings,
    });
  } catch (err) {
    console.error("SWING ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

