export function formatMoney(amount) {
  const n = Number(amount == null || amount === "" ? 0 : amount);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}
