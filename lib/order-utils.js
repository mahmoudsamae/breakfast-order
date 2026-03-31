export const MAX_QTY_PER_ITEM = 10;

export function getBerlinNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour)
  };
}

/** Berlin calendar date YYYY-MM-DD offset by whole days from today (Berlin). */
export function berlinDateWithOffset(deltaDays) {
  const { date } = getBerlinNow();
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  const unix = Date.UTC(y, m - 1, d + Number(deltaDays || 0));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(unix));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function tomorrowBerlinDate() {
  return berlinDateWithOffset(1);
}

/** Bestellfenster: 08:00 bis unter 21:00 Uhr. */
export function isOrderingOpen(hour) {
  return hour >= 8 && hour < 21;
}

/** Hour 0–23 in Europe/Berlin for an ISO timestamp */
export function berlinHourFromIso(isoString) {
  if (!isoString) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date(isoString));
  const h = parts.find((p) => p.type === "hour")?.value;
  return h != null ? Number(h) : null;
}

/** Berlin calendar date YYYY-MM-DD for an ISO timestamp */
export function berlinDateFromIso(isoString) {
  if (!isoString) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(isoString));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
