-- Optional custom message shown to guests when ordering is paused.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS guest_orders_paused_message text;

COMMENT ON COLUMN public.branches.guest_orders_paused_message IS
  'Guest-facing text when guest_orders_paused is true. NULL = use app default.';
