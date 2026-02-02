export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400 }
    );
  }

  const { symbols } = body ?? {};

  if (!Array.isArray(symbols) || symbols.length === 0) {
    return Response.json(
      { error: "symbols_required" },
      { status: 400 }
    );
  }

  return Response.json({
    mode: "daily",
    symbols,
    data: null
  });
}
