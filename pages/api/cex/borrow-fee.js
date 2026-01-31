
export default async function handler(req, res) {
  try {
    const symbol = (req.query.symbol || "").toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol" });
    }

    const url =
      `https://chartexchange.com/api/v1/data/stocks/borrow-fee/ib/` +
      `?symbol=${symbol}&format=json&api_key=${process.env.CHARTEXCHANGE_API_KEY}`;

    const r = await fetch(url);
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
