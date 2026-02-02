export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { universe, min_confidence = "MEDIUM" } = req.body;

    if (!Array.isArray(universe) || universe.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        detail: "universe must be a non-empty array"
      });
    }

    // --- MOCK SWING SCAN LOGIC ---
    const bullish = [];
    const bearish = [];

    universe.forEach((symbol, idx) => {
      if (idx % 2 === 0) {
        bullish.push({
          rank: bullish.length + 1,
          symbol,
          regime: "ACCUMULATION",
          time_horizon_days: 5,
          confidence: min_confidence,
          pressure_driver: "Dealer long gamma unwind"
        });
      } else {
        bearish.push({
          rank: bearish.length + 1,
          symbol,
          regime: "DISTRIBUTION",
          time_horizon_days: 4,
          confidence: min_confidence,
          pressure_driver: "Put wall magnet + short interest expansion"
        });
      }
    });

    return res.status(200).json({
      scan_date: new Date().toISOString().slice(0, 10),
      bullish_swings: bullish.slice(0, 5),
      bearish_swings: bearish.slice(0, 5)
    });

  } catch (err) {
    console.error("Swing scanner error:", err);
    return res.status(500).json({
      error: "Swing scanner failed",
      detail: err.message
    });
  }
}
