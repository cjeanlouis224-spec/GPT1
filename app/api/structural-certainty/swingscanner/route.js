import { fetchChainSummary } from "@/app/lib/fetchChainSummary";
import { computeStructuralCertainty } from "@/app/lib/structuralCertaintyEngine";

export async function POST(req) {
  const { symbol } = await req.json();
  const apiKey = process.env.CHARTEXCHANGE_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "missing_api_key" }, { status: 500 });
  }

  const chainSummary = await fetchChainSummary(symbol, apiKey);

  const result = computeStructuralCertainty({
    symbol,
    chainSummary,
    mode: "SWING"
  });

  // Swing-specific override (HARD RULE)
  if (result.regime === "NEUTRAL") {
    result.allowed = false;
    result.reason = "DAILY_NOT_ALIGNED";
  }

  return Response.json(result);
}
