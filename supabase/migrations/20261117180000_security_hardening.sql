-- Security hardening. Apply in the Supabase SQL editor. Safe to run twice.
-- The app uses the service role only. anon and authenticated lose table, sequence,
-- and function access in schema public.

-- -----------------------------------------------------------------------------
-- 1) Fixed search_path (advisor: Function Search Path Mutable)
--    Known in repo SQL: clean_csv_cell(text), create_order(text, date, text, jsonb, numeric, bigint),
--    enforce_menu_items_same_branch(), enforce_order_items_same_branch().
--    cleanup_expired_registrations_intake and assign_registration_number are not defined in
--    this repo, so every overload of those names is updated the same way.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn record;
  fn_path text;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname, p.proname) IN (
      ('import_staging', 'clean_csv_cell'),
      ('public', 'create_order'),
      ('public', 'cleanup_expired_registrations_intake'),
      ('public', 'enforce_menu_items_same_branch'),
      ('public', 'enforce_order_items_same_branch'),
      ('public', 'assign_registration_number')
    )
  LOOP
    IF fn.schema_name = 'import_staging' THEN
      fn_path := 'import_staging';
    ELSE
      fn_path := 'public';
    END IF;

    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = %s',
      fn.schema_name,
      fn.function_name,
      fn.identity_args,
      fn_path
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Login failures. ip_hash is SHA-256 hex. The raw IP is never stored.
--    locked_until is set when a key reaches 5 failures inside 15 minutes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('branch', 'root')),
  branch_id bigint REFERENCES public.branches (id) ON DELETE CASCADE,
  username text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

CREATE INDEX IF NOT EXISTS login_attempts_user_created_idx
  ON public.login_attempts (scope, branch_id, username, created_at DESC);

CREATE INDEX IF NOT EXISTS login_attempts_ip_created_idx
  ON public.login_attempts (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS login_attempts_locked_until_idx
  ON public.login_attempts (locked_until);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Soft-cancel. The row stays; lists, revenue and counts ignore it while cancelled_at is set.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason text;

-- One row per order action. order_id stays after a permanent delete.
CREATE TABLE IF NOT EXISTS public.order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint REFERENCES public.orders (id) ON DELETE SET NULL,
  branch_id bigint NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  action text NOT NULL,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb
);

CREATE INDEX IF NOT EXISTS order_events_branch_created_idx
  ON public.order_events (branch_id, created_at DESC);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3) Privileges. service_role keeps access because that is the only app role.
--    PUBLIC is revoked as well: anon and authenticated would still execute
--    functions through a PUBLIC grant.
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['postgres', 'supabase_admin']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
        role_name
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4) Drop login failures older than one day. 02:10 UTC, after the 02:00 jobs.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing bigint;
BEGIN
  SELECT jobid INTO existing
  FROM cron.job
  WHERE jobname = 'purge_login_attempts'
  LIMIT 1;

  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;

  PERFORM cron.schedule(
    'purge_login_attempts',
    '10 2 * * *',
    $cmd$DELETE FROM public.login_attempts WHERE created_at < now() - interval '1 day'$cmd$
  );
END $$;

-- -----------------------------------------------------------------------------
-- 5) Drop order action rows older than 180 days. 02:20 UTC.
--    details stores no names; this only limits how long the log is kept.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  existing bigint;
BEGIN
  SELECT jobid INTO existing
  FROM cron.job
  WHERE jobname = 'purge_order_events'
  LIMIT 1;

  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;

  PERFORM cron.schedule(
    'purge_order_events',
    '20 2 * * *',
    $cmd$DELETE FROM public.order_events WHERE created_at < now() - interval '180 days'$cmd$
  );
END $$;
