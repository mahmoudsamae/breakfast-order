import { berlinDateFromIso, getBerlinNow } from "@/lib/order-utils";

export const EXCEL_PRODUCT_COLUMNS = ["Knusperbrötchen", "Farmerbrötchen", "Laugenbrezel", "Buttercroissant"];

function berlinDateTimeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

function productCountsFromOrderItems(orderItems) {
  const counts = Object.fromEntries(EXCEL_PRODUCT_COLUMNS.map((name) => [name, 0]));
  for (const i of orderItems || []) {
    const qty = Number(i?.quantity || 0);
    if (qty <= 0) continue;
    const productName = i?.products?.name || "";
    if (!productName) continue;
    if (Object.prototype.hasOwnProperty.call(counts, productName)) {
      counts[productName] += qty;
    }
  }
  return counts;
}

function totalItems(orderItems) {
  let n = 0;
  for (const i of orderItems || []) n += Number(i?.quantity || 0);
  return n;
}

function statusLabel(status) {
  if (status === "pending") return "pending";
  if (status === "delivered") return "delivered";
  return String(status || "");
}

export function mapOrdersForExcel(orders) {
  return (orders || []).map((o) => ({
    orderNumber: o?.order_number ?? "",
    customerName: o?.customer_name || "",
    placeNumber: o?.place_number || "",
    pickupDate: o?.pickup_date || "",
    pickupTime: o?.pickup_time || "",
    ...productCountsFromOrderItems(o?.order_items || []),
    totalItemsCount: totalItems(o?.order_items || []),
    totalPrice: Number(o?.total_amount || 0),
    note: o?.note || "",
    status: statusLabel(o?.status),
    createdAt: berlinDateTimeLabel(o?.created_at)
  }));
}

export function resolveExportDate(rawDate) {
  return String(rawDate || getBerlinNow().date);
}

export function isOrderOnBerlinDate(order, dateYmd) {
  return berlinDateFromIso(order?.created_at) === dateYmd;
}
