export const LAST_ORDER_STORAGE_KEY = "fruehstueck_last_order_v1";

/** @param {string | undefined} branchSlug */
export function lastOrderStorageKey(branchSlug) {
  const s = String(branchSlug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!s) return LAST_ORDER_STORAGE_KEY;
  return `${LAST_ORDER_STORAGE_KEY}_${s}`;
}

/** @param {string | undefined} branchSlug */
/** @returns {object | null} */
export function readLastOrderSummary(branchSlug) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lastOrderStorageKey(branchSlug));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    const orderNumber = Number(data.orderNumber);
    if (!Number.isFinite(orderNumber)) return null;
    if (typeof data.customerName !== "string" || !data.customerName.trim()) return null;
    if (typeof data.total !== "number" || !Number.isFinite(data.total)) return null;
    if (!Array.isArray(data.lines)) return null;
    return { ...data, orderNumber };
  } catch {
    return null;
  }
}

/** @param {object} payload @param {string | undefined} branchSlug */
export function writeLastOrderSummary(payload, branchSlug) {
  if (typeof window === "undefined") return;
  const on = Number(payload?.orderNumber);
  if (!Number.isFinite(on)) return;
  try {
    window.localStorage.setItem(lastOrderStorageKey(branchSlug), JSON.stringify({ ...payload, orderNumber: on }));
  } catch {
    /* quota / private mode */
  }
}
