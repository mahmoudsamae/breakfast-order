-- Admin can pause guest (QR) ordering per branch. Staff/admin stay unaffected.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS guest_orders_paused boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.branches.guest_orders_paused IS
  'When true, guest order page/API is closed. Staff and admin workflows stay open.';
