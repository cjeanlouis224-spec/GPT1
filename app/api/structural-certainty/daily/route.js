import { NextResponse } from "next/server";

const DEFAULT_SYMBOLS = ["SPY", "QQQ", "IWM"];

export async function POST(req) {
  let symbols = DEFAULT_SYMBOLS;

  try {
    const body = await req.json();
    if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
      symbols = body.symbols;
    }
  } catch (_) {}

  const apiKey = process.env.CHARTEXCHANGE_API_KEY;

  // ─────────────────────────────────────────────
  // SAFE BASE RESPONSE (NO BIAS, NO DIRECTION)
  // ─────────────────────────────────────────────
  const baseResponse = {
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
      primary_risk: "Insufficient structural data",
      final_instruction: "NO_TRADE",
    },
  };

  // If no API key → hard NO_TRADE
  if (!apiKey) {
    return NextResponse.json(baseResponse);
  }

  try {
    // Attempt to enrich Tool 1 ONLY (stress, not bias)
    for (const symbol of symbols) {
      const url =
        `https://chartexchange.com/api/v1/data/options/chain-summary/` +
        `?symbol=${symbol}&format=json&api_key=${apiKey}`;

      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;

      const data = await r.json();
      const row = data?.[0];
      if (!row) continue;

      // Minimal stress inference (still non-directional)
      baseResponse.stressMap = {
        stress_side:
          row.putsTotal > row.callsTotal
            ? "PUT"
            : row.callsTotal > row.putsTotal
            ? "CALL"
            : "NEUTRAL",
        stress_location: "STRADDLED",
        distance_to_stress: "MID",
        authority: "HIGH",
      };

      baseResponse.executionGate.primary_risk =
        "Stress detected but no open resolution yet";
    }

    return NextResponse.json(baseResponse);
  } catch (err) {
    // Any failure → NO_TRADE
    return NextResponse.json(baseResponse);
  }
}
