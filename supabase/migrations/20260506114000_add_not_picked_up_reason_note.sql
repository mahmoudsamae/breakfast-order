-- Add optional reason/note fields for "not_picked_up" workflow.
-- Additive only; no behavior changes for existing orders.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS not_picked_up_reason text,
  ADD COLUMN IF NOT EXISTS not_picked_up_note text;

COMMIT;

