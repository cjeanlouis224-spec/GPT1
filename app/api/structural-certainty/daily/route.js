import { NextResponse } from "next/server";
import { fetchChainSummary } from "@/app/lib/fetchChainSummary";
import { runStructuralCertainty } from "@/app/lib/structuralCertaintyEngine";

const DEFAULT_SYMBOLS = ["QQQ", "SPY", "IWM"];

export async function POST(req) {
  let symbols = DEFAULT_SYMBOLS;

  // ─────────────────────────────────────────────
  // Parse request body (optional symbols override)
  // ─────────────────────────────────────────────
  try {
    const body = await req.json();
    if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
      symbols = body.symbols;
    }
  } catch (_) {
    // report / run → defaults apply
  }

  const apiKey = process.env.CHARTEXCHANGE_API_KEY;

  // ─────────────────────────────────────────────
  // Hard guard: no API key = NO_TRADE (but still report)
  // ─────────────────────────────────────────────
  if (!apiKey) {
    return NextResponse.json(
      buildNoDataResponse(symbols, "NO_API_KEY")
    );
  }

  const results = [];

  // ─────────────────────────────────────────────
  // MAIN LOOP — one symbol at a time
  // ─────────────────────────────────────────────
  for (const symbol of symbols) {
    try {
      // 🔴 PROOF LOG — must appear in Vercel
      console.log("[DAILY] fetching chain summary for", symbol);

      const chainSummary = await fetchChainSummary(symbol, apiKey);

      if (!chainSummary) {
        results.push(
          buildNoDataSymbolResult(symbol, "CHAIN_SUMMARY_NULL")
        );
        continue;
      }

      // 🔴 PROOF LOG — confirms live data shape
      console.log("[DAILY] live OI data", symbol, {
        callsTotal: chainSummary.callsTotal,
        putsTotal: chainSummary.putsTotal,
        maxPain: chainSummary.maxPain,
      });

      // Delegate ALL logic to engine
      const engineResult = runStructuralCertainty({
        symbol,
        chainSummary,
        context: "INTRADAY",
      });

      // Attach hard proof markers
      engineResult.executionGate.data_source = "LIVE_CHARTEXCHANGE";
      engineResult.executionGate.data_timestamp =
        new Date().toISOString();

      results.push(engineResult);
    } catch (err) {
      console.error("[DAILY] ERROR", symbol, err);

      results.push(
        buildNoDataSymbolResult(symbol, "FETCH_ERROR")
      );
    }
  }

  // ─────────────────────────────────────────────
  // REPORT FORMAT — list each symbol separately
  // ─────────────────────────────────────────────
  return NextResponse.json({
    mode: "REPORT",
    symbols,
    results,
  });
}

/* ───────────────────────────────────────────── */
/* HELPERS                                      */
/* ───────────────────────────────────────────── */

function buildNoDataResponse(symbols, reason) {
  return {
    mode: "REPORT",
    symbols,
    results: symbols.map((s) =>
      buildNoDataSymbolResult(s, reason)
    ),
  };
}

function buildNoDataSymbolResult(symbol, reason) {
  return {
    symbol,
    stressMap: {
      stress_side: "NEUTRAL",
      stress_location: "STRADDLED",
      distance_to_stress: "FAR",
      authority: "LOW",
    },
    openResolution: {
      open_state: "UNRESOLVED",
      interaction_with_stress: "NO",
      early_volatility: "NORMAL",
    },
    riskPermission: {
      permission: "BLOCK",
      size_cap: "MINIMAL",
      hold_cap: "OPEN_ONLY",
      blocked_behaviors: ["REVERSAL", "FADE", "HOLD"],
    },
    executionGate: {
      daily_alignment: "UNKNOWN",
      checklist_complete: "NO",
      allowed_setups: [],
      primary_risk: "Insufficient structural confirmation",
      final_instruction: "NO_TRADE",
      data_source: reason,
    },
  };
}
