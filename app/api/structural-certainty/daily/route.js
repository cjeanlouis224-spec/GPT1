import { fetchChainSummary } from "@/app/lib/fetchChainSummary";
import { computeStructuralCertainty } from "@/app/lib/structuralCertaintyEngine";
import { buildTradeChecklist } from "@/app/lib/buildTradeChecklist";

export async function POST(req) {
  const { symbol } = await req.json();
  const apiKey = process.env.CHARTEXCHANGE_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "missing_api_key" }, { status: 500 });
  }

  const chainSummary = await fetchChainSummary(symbol, apiKey);

  const baseResult = computeStructuralCertainty({
    symbol,
    chainSummary,
    mode: "DAILY"
  });

  const checklist = buildTradeChecklist(baseResult);

  return Response.json(checklist);
}
