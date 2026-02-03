if (bias.direction === "LONG_ONLY") {
  allowedTrades = ["CALLS", "LONG_SHARES"];
  blockedTrades = ["PUTS", "SHORTS"];
}

if (bias.direction === "NEUTRAL") {
  allowedTrades = [];
  blockedTrades = ["ALL"];
}
