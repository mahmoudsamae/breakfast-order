-- Staff Vor-Ort: optional prepayment marker for tomorrow pickup (operational only; revenue stays on delivered).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;

COMMENT ON COLUMN public.orders.paid_at IS
  'When staff marked a tomorrow Vor-Ort order as paid at capture time; NULL = pay on pickup.';
