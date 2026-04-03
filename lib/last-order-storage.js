export const LAST_ORDER_STORAGE_KEY = "fruehstueck_last_order_v1";

/** @returns {object | null} */
export function readLastOrderSummary() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ORDER_STORAGE_KEY);
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

/** @param {object} payload */
export function writeLastOrderSummary(payload) {
  if (typeof window === "undefined") return;
  const on = Number(payload?.orderNumber);
  if (!Number.isFinite(on)) return;
  try {
    window.localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify({ ...payload, orderNumber: on }));
  } catch {
    /* quota / private mode */
  }
}
