export const NOT_PICKED_UP_REASON_OPTIONS = [
  { value: "customer_no_show", label: "Kunde nicht erschienen" },
  { value: "duplicate_order", label: "Doppelbestellung" },
  { value: "replacement_compensation", label: "Ersatz / Kulanz" },
  { value: "cancelled_by_customer", label: "Kunde hat storniert" },
  { value: "cancelled_by_staff", label: "Team hat storniert" },
  { value: "wrong_pickup_time", label: "Falsche Abholzeit" },
  { value: "payment_issue", label: "Zahlungsproblem" },
  { value: "other", label: "Sonstiges" }
];

export const DEFAULT_NOT_PICKED_UP_REASON = "customer_no_show";

export function normalizeNotPickedUpReason(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return DEFAULT_NOT_PICKED_UP_REASON;
  return NOT_PICKED_UP_REASON_OPTIONS.some((x) => x.value === value) ? value : null;
}

