-- Nightly retention: replace guest names on past pickup days, and schedule the
-- existing registrations intake cleanup. Apply in the Supabase SQL editor.
-- Do not run this from the app.

CREATE OR REPLACE FUNCTION public.anonymize_past_order_names()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.orders
  SET customer_name = 'Gast'
  WHERE pickup_date < (timezone('Europe/Berlin', now()))::date
    AND customer_name IS DISTINCT FROM 'Gast';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.anonymize_past_order_names() IS
  'Sets customer_name to Gast for orders whose pickup day in Europe/Berlin is already over. Returns the number of updated rows.';

-- Default privileges grant EXECUTE to PUBLIC, which includes anon and authenticated.
REVOKE ALL ON FUNCTION public.anonymize_past_order_names() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anonymize_past_order_names() FROM anon;
REVOKE EXECUTE ON FUNCTION public.anonymize_past_order_names() FROM authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule by the stable job name first so this file can be applied twice.
DO $$
DECLARE
  existing bigint;
BEGIN
  SELECT jobid INTO existing
  FROM cron.job
  WHERE jobname = 'anonymize_past_order_names'
  LIMIT 1;

  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;

  PERFORM cron.schedule(
    'anonymize_past_order_names',
    '0 2 * * *',
    $cmd$SELECT public.anonymize_past_order_names();$cmd$
  );
END;
$$;

DO $$
DECLARE
  existing bigint;
BEGIN
  SELECT jobid INTO existing
  FROM cron.job
  WHERE jobname = 'cleanup_expired_registrations_intake'
  LIMIT 1;

  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;

  PERFORM cron.schedule(
    'cleanup_expired_registrations_intake',
    '0 2 * * *',
    $cmd$SELECT public.cleanup_expired_registrations_intake();$cmd$
  );
END;
$$;
