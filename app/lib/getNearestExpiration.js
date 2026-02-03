export function getNearestExpiration(expirations = []) {
  if (!Array.isArray(expirations) || expirations.length === 0) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);

  return expirations
    .filter(d => d >= today)
    .sort()[0] ?? null;
}
