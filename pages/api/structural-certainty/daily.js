async function fetchJSON(url) {
  const r = await fetch(url);
  return r.json();
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export default async function handler(req, res) {
  try {
    const symbol = (req.query.symbol || "").toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol" });
    }

    const base = `${req.headers.origin || "https://gpt-1-mu-five.vercel.app"}/api/cex`;

    const [
      volume,
      shortVol,
      shortInterest,
      borrow,
      ftd
    ] = await Promise.all([
      fetchJSON(`${base}/exchange-volume?symbol=${symbol}`),
      fetchJSON(`${base}/short-volume?symbol=${symbol}`),
      fetchJSON(`${base}/short-interest-daily?symbol=${symbol}`),
      fetchJSON(`${base}/borrow-fee?symbol=${symbol}`),
      fetchJSON(`${base}/ftd?symbol=${symbol}`)
    ]);

    // ---------------------------
    // NORMALIZATION (v1 simple)
    // ---------------------------

    const participationScore = clamp(
      volume?.volume_ratio ? volume.volume_ratio * 100 : 0
    );

    const shortVolumeScore = clamp(
      shortVol?.short_volume_ratio ? shortVol.short_volume_ratio * 100 : 0
    );

    const shortInterestScore = clamp(
      shortInterest?.change_pct ? Math.abs(shortInterest.change_pct) * 50 : 0
    );

    const borrowFeeScore = clamp(
      borrow?.rate ? borrow.rate * 10 : 0
    );

    const ftdScore = clamp(
      ftd?.total ? Math.log10(ftd.total + 1) * 25 : 0
    );

    // ---------------------------
    // STRUCTURAL CERTAINTY SCORE
    // ---------------------------

    const certainty =
      0.25 * participationScore +
      0.20 * shortVolumeScore +
      0.20 * shortInterestScore +
      0.20 * borrowFeeScore +
      0.15 * ftdScore;

    res.json({
      symbol,
      certainty: Math.round(certainty),
      components: {
        participationScore,
        shortVolumeScore,
        shortInterestScore,
        borrowFeeScore,
        ftdScore
      },
      regime:
        certainty >= 70
          ? "FORCED_RESOLUTION"
          : certainty >= 45
          ? "TENSION_BUILDING"
          : "FREE_FLOAT"
    });

  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
