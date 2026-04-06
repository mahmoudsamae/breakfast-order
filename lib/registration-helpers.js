/** @param {string} arrivalYmd @param {string} departureYmd */
export function stayNightsFromIsoDates(arrivalYmd, departureYmd) {
  const a = new Date(`${arrivalYmd}T12:00:00.000Z`);
  const d = new Date(`${departureYmd}T12:00:00.000Z`);
  const ms = d.getTime() - a.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms / 86400000);
}

export function trimOrNull(s, maxLen) {
  if (s == null) return null;
  const t = String(s).trim();
  if (t === "") return null;
  if (maxLen != null && t.length > maxLen) return t.slice(0, maxLen);
  return t;
}

export function hasTruthyText(s) {
  return trimOrNull(s) != null;
}
