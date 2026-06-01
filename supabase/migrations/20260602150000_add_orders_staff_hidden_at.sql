-- Staff list: hide completed orders from "Erledigt" tab without deleting rows.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS staff_hidden_at timestamptz;

COMMENT ON COLUMN public.orders.staff_hidden_at IS
  'Set when staff clears the done list for a pickup day; order remains in DB and admin reports.';
