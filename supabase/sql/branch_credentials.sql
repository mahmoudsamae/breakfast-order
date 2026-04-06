-- Run on DBs that already have branches + multi-branch schema (TEST or production).
-- Credentials for internal login at /b/[slug]/login

CREATE TABLE IF NOT EXISTS public.branch_credentials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  username text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('team', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_credentials_username_nonempty CHECK (length(trim(username)) > 0),
  CONSTRAINT branch_credentials_branch_username_uq UNIQUE (branch_id, username)
);

CREATE INDEX IF NOT EXISTS branch_credentials_branch_id_idx ON public.branch_credentials (branch_id);

COMMENT ON TABLE public.branch_credentials IS 'Per-branch internal logins; verify with bcrypt in app, never store plaintext.';

-- Example (generate hash with Node: require("bcryptjs").hashSync("yourpassword", 12))
-- INSERT INTO public.branch_credentials (branch_id, username, password_hash, role)
-- SELECT id, 'kitchen', '$2a$12$...', 'team' FROM public.branches WHERE slug = 'regensburg' LIMIT 1;
--
-- Hannover test users (after seed_hannover_test_branch.sql): hannover_team / HannoverTeam2026!
--   and hannover_admin / HannoverAdmin2026!
