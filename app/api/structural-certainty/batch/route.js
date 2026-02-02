export async function POST() {
  return Response.json({
    status: "deprecated",
    message: "batchCheck is deprecated. DAILY is the authoritative source.",
    instruction: "Ignore batchCheck. Use dailyCheck instead."
  }, { status: 200 });
}
