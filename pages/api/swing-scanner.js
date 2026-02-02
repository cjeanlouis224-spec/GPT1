// pages/api/structural-certainty/swing-scanner.js

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!req.body) {
      return res.status(400).json({
        error: "Request body missing",
        example: { universe: ["IWM", "SPY", "QQQ"] }
      });
    }

    const { universe, min_confidence = "MEDIUM" } = req.body;

    if (!Array.isArray(universe) || universe.length === 0) {
      return res.status(400).json({
        error: "Missing or invalid universe parameter",
        example: { universe: ["IWM", "SPY", "QQQ"] }
      });
    }

    // ---- TEMP SWING MOCK (replace later) ----
    const setups = universe.map((symbol) => ({
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

  } catch (err) {
    return res.status(500).json({
      error: "Swing scanner failed",
      detail: err.message
    });
  }
}
