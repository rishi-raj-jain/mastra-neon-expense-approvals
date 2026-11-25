CREATE TABLE expense_policies (
  category text PRIMARY KEY,
  auto_approve_limit_cents integer NOT NULL CHECK (auto_approve_limit_cents >= 0)
);

INSERT INTO expense_policies (category, auto_approve_limit_cents) VALUES
  ('meals', 7500),
  ('software', 20000),
  ('equipment', 30000),
  ('travel', 50000);

CREATE TABLE expense_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES neon_auth.organization (id),
  requester_id uuid NOT NULL REFERENCES neon_auth."user" (id),
  category text NOT NULL REFERENCES expense_policies (category),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected')),
  workflow_run_id text,
  decided_by uuid REFERENCES neon_auth."user" (id),
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX ON expense_requests (requester_id, created_at DESC);
