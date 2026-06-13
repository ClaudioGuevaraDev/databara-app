\set ON_ERROR_STOP on

DROP DATABASE IF EXISTS databara_dev;
DROP DATABASE IF EXISTS databara_ops;
DROP DATABASE IF EXISTS databara_finance;
DROP DATABASE IF EXISTS databara_observability;

CREATE DATABASE databara_dev;
CREATE DATABASE databara_ops;
CREATE DATABASE databara_finance;
CREATE DATABASE databara_observability;

\connect databara_dev

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA analytics;

CREATE TABLE public.customers (
  customer_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'paused', 'cancelled')),
  plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'team', 'enterprise')),
  country char(2) NOT NULL,
  company_size integer NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz
);

CREATE TABLE public.products (
  product_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  active boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE public.orders (
  order_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES public.customers(customer_id),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  created_at timestamptz NOT NULL
);

CREATE TABLE public.order_items (
  order_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.orders(order_id),
  product_id bigint NOT NULL REFERENCES public.products(product_id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0)
);

CREATE TABLE public.invoices (
  invoice_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL UNIQUE REFERENCES public.orders(order_id),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'refunded')),
  issued_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL
);

CREATE TABLE public.payments (
  payment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id bigint NOT NULL REFERENCES public.invoices(invoice_id),
  provider text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL CHECK (status IN ('authorized', 'captured', 'failed', 'refunded')),
  processed_at timestamptz NOT NULL
);

CREATE TABLE public.support_tickets (
  ticket_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES public.customers(customer_id),
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL CHECK (status IN ('open', 'pending', 'solved', 'closed')),
  subject text NOT NULL,
  created_at timestamptz NOT NULL,
  solved_at timestamptz
);

CREATE TABLE public.audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint REFERENCES public.customers(customer_id),
  actor text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

INSERT INTO public.customers (
  email, full_name, status, plan, country, company_size, metadata, created_at, updated_at
)
SELECT
  'customer' || gs || '@databara.dev',
  'Customer ' || gs,
  (ARRAY['active', 'active', 'active', 'trialing', 'paused', 'cancelled'])[1 + floor(random() * 6)::int],
  (ARRAY['starter', 'pro', 'team', 'enterprise'])[1 + floor(random() * 4)::int],
  (ARRAY['US', 'CL', 'BR', 'MX', 'CO', 'AR', 'ES', 'CA'])[1 + floor(random() * 8)::int],
  1 + floor(random() * 5000)::int,
  jsonb_build_object('source', (ARRAY['organic', 'sales', 'partner', 'import'])[1 + floor(random() * 4)::int], 'score', floor(random() * 1000)::int),
  now() - (random() * interval '900 days'),
  CASE WHEN random() < 0.75 THEN now() - (random() * interval '120 days') END
FROM generate_series(1, 50000) AS gs;

INSERT INTO public.products (sku, name, category, price_cents, active, created_at)
SELECT
  'SKU-' || lpad(gs::text, 5, '0'),
  'Databara Product ' || gs,
  (ARRAY['subscription', 'addon', 'service', 'training', 'connector'])[1 + floor(random() * 5)::int],
  (ARRAY[900, 1900, 3900, 5900, 12900, 24900, 49900, 149900])[1 + floor(random() * 8)::int],
  random() > 0.08,
  now() - (random() * interval '1200 days')
FROM generate_series(1, 800) AS gs;

INSERT INTO public.orders (customer_id, total_cents, currency, status, created_at)
SELECT
  1 + floor(random() * 50000)::bigint,
  1000 + floor(random() * 250000)::int,
  (ARRAY['USD', 'CLP', 'BRL', 'MXN', 'EUR'])[1 + floor(random() * 5)::int],
  (ARRAY['paid', 'paid', 'paid', 'pending', 'refunded', 'failed'])[1 + floor(random() * 6)::int],
  now() - (random() * interval '730 days')
FROM generate_series(1, 150000);

INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_cents)
SELECT
  o.order_id,
  1 + floor(random() * 800)::bigint,
  1 + floor(random() * 5)::int,
  900 + floor(random() * 149000)::int
FROM public.orders AS o
CROSS JOIN LATERAL generate_series(1, 1 + floor(random() * 4)::int);

INSERT INTO public.invoices (order_id, amount_cents, status, issued_at, due_at)
SELECT
  order_id,
  total_cents,
  CASE status WHEN 'paid' THEN 'paid' WHEN 'refunded' THEN 'refunded' WHEN 'failed' THEN 'void' ELSE 'open' END,
  created_at + interval '1 hour',
  created_at + interval '31 days'
FROM public.orders
WHERE status IN ('paid', 'pending', 'refunded', 'failed')
ORDER BY random()
LIMIT 45000;

INSERT INTO public.payments (invoice_id, provider, amount_cents, status, processed_at)
SELECT
  invoice_id,
  (ARRAY['stripe', 'paypal', 'wire', 'local_card'])[1 + floor(random() * 4)::int],
  amount_cents,
  CASE status WHEN 'paid' THEN 'captured' WHEN 'refunded' THEN 'refunded' WHEN 'void' THEN 'failed' ELSE 'authorized' END,
  issued_at + (random() * interval '5 days')
FROM public.invoices
WHERE status <> 'draft';

INSERT INTO public.support_tickets (
  customer_id, priority, status, subject, created_at, solved_at
)
SELECT
  1 + floor(random() * 50000)::bigint,
  (ARRAY['low', 'normal', 'high', 'urgent'])[1 + floor(random() * 4)::int],
  (ARRAY['open', 'pending', 'solved', 'closed'])[1 + floor(random() * 4)::int],
  'Support request #' || gs,
  now() - (random() * interval '365 days'),
  CASE WHEN random() < 0.65 THEN now() - (random() * interval '180 days') END
FROM generate_series(1, 30000) AS gs;

INSERT INTO public.audit_events (customer_id, actor, event_type, payload, created_at)
SELECT
  CASE WHEN random() < 0.92 THEN 1 + floor(random() * 50000)::bigint END,
  (ARRAY['system', 'user', 'admin', 'api'])[1 + floor(random() * 4)::int],
  (ARRAY['login', 'query.run', 'connection.create', 'export.csv', 'settings.update'])[1 + floor(random() * 5)::int],
  jsonb_build_object('ip', '10.0.' || floor(random() * 255)::int || '.' || floor(random() * 255)::int, 'request_id', gen_random_uuid()),
  now() - (random() * interval '365 days')
FROM generate_series(1, 500000);

CREATE INDEX idx_customers_status ON public.customers(status);
CREATE INDEX idx_customers_plan ON public.customers(plan);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_status_created_at ON public.orders(status, created_at DESC);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_tickets_customer_id ON public.support_tickets(customer_id);
CREATE INDEX idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX idx_audit_events_type ON public.audit_events(event_type);

CREATE VIEW public.active_customers AS
SELECT
  c.customer_id,
  c.email,
  max(o.created_at) AS last_order_at,
  coalesce(sum(o.total_cents), 0)::integer AS lifetime_value_cents
FROM public.customers AS c
LEFT JOIN public.orders AS o ON o.customer_id = c.customer_id AND o.status IN ('paid', 'refunded')
WHERE c.status = 'active'
GROUP BY c.customer_id, c.email;

CREATE VIEW public.invoice_aging AS
SELECT
  status,
  count(*) AS invoices,
  sum(amount_cents) AS amount_cents,
  min(due_at) AS oldest_due_at
FROM public.invoices
GROUP BY status;

CREATE TABLE analytics.daily_revenue AS
SELECT
  day::date AS revenue_date,
  coalesce(sum(o.total_cents) FILTER (WHERE o.status IN ('paid', 'refunded')), 0)::integer AS gross_cents,
  coalesce(sum(o.total_cents) FILTER (WHERE o.status = 'refunded'), 0)::integer AS refund_cents,
  coalesce(sum(o.total_cents) FILTER (WHERE o.status = 'paid'), 0)::integer AS net_cents
FROM generate_series(current_date - 731, current_date, interval '1 day') AS day
LEFT JOIN public.orders AS o ON o.created_at::date = day::date
GROUP BY day;

ALTER TABLE analytics.daily_revenue ADD PRIMARY KEY (revenue_date);

CREATE VIEW analytics.customer_segments AS
SELECT
  plan AS segment,
  count(*)::integer AS customers,
  avg(coalesce(value.ltv, 0))::integer AS avg_ltv_cents
FROM public.customers AS c
LEFT JOIN LATERAL (
  SELECT sum(total_cents) AS ltv
  FROM public.orders AS o
  WHERE o.customer_id = c.customer_id AND o.status = 'paid'
) AS value ON true
GROUP BY plan;

ANALYZE;

\connect databara_ops

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA crm;
CREATE SCHEMA work;
CREATE SCHEMA audit;

CREATE TABLE crm.organizations (
  organization_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  industry text NOT NULL,
  region text NOT NULL,
  employees integer NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE crm.contacts (
  contact_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES crm.organizations(organization_id),
  email text NOT NULL UNIQUE,
  title text NOT NULL,
  is_primary boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE work.users (
  user_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL
);

CREATE TABLE work.projects (
  project_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES crm.organizations(organization_id),
  owner_user_id bigint NOT NULL REFERENCES work.users(user_id),
  name text NOT NULL,
  status text NOT NULL,
  budget_cents integer NOT NULL,
  started_at date NOT NULL,
  ended_at date
);

CREATE TABLE work.tasks (
  task_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES work.projects(project_id),
  assignee_user_id bigint REFERENCES work.users(user_id),
  title text NOT NULL,
  status text NOT NULL,
  priority text NOT NULL,
  estimate_hours numeric(8, 2) NOT NULL,
  created_at timestamptz NOT NULL,
  due_at timestamptz
);

CREATE TABLE work.task_comments (
  comment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES work.tasks(task_id),
  author_user_id bigint NOT NULL REFERENCES work.users(user_id),
  body text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE audit.status_changes (
  change_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id bigint NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by bigint REFERENCES work.users(user_id),
  changed_at timestamptz NOT NULL
);

INSERT INTO crm.organizations (name, industry, region, employees, created_at)
SELECT
  'Organization ' || gs,
  (ARRAY['software', 'finance', 'healthcare', 'retail', 'education', 'logistics'])[1 + floor(random() * 6)::int],
  (ARRAY['north_america', 'latin_america', 'europe', 'apac'])[1 + floor(random() * 4)::int],
  5 + floor(random() * 10000)::int,
  now() - (random() * interval '1200 days')
FROM generate_series(1, 5000) AS gs;

INSERT INTO crm.contacts (organization_id, email, title, is_primary, created_at)
SELECT
  1 + floor(random() * 5000)::bigint,
  'contact' || gs || '@example.test',
  (ARRAY['CEO', 'CTO', 'Data Lead', 'Operations Manager', 'Analyst'])[1 + floor(random() * 5)::int],
  random() < 0.18,
  now() - (random() * interval '900 days')
FROM generate_series(1, 25000) AS gs;

INSERT INTO work.users (email, display_name, role, active)
SELECT
  'user' || gs || '@databara.dev',
  'User ' || gs,
  (ARRAY['admin', 'developer', 'analyst', 'operator', 'viewer'])[1 + floor(random() * 5)::int],
  random() > 0.06
FROM generate_series(1, 500) AS gs;

INSERT INTO work.projects (
  organization_id, owner_user_id, name, status, budget_cents, started_at, ended_at
)
SELECT
  1 + floor(random() * 5000)::bigint,
  1 + floor(random() * 500)::bigint,
  'Project ' || gs,
  (ARRAY['planning', 'active', 'active', 'paused', 'completed'])[1 + floor(random() * 5)::int],
  100000 + floor(random() * 20000000)::int,
  current_date - floor(random() * 720)::int,
  CASE WHEN random() < 0.25 THEN current_date - floor(random() * 120)::int END
FROM generate_series(1, 20000) AS gs;

INSERT INTO work.tasks (
  project_id, assignee_user_id, title, status, priority, estimate_hours, created_at, due_at
)
SELECT
  1 + floor(random() * 20000)::bigint,
  CASE WHEN random() < 0.9 THEN 1 + floor(random() * 500)::bigint END,
  'Task ' || gs,
  (ARRAY['todo', 'in_progress', 'review', 'blocked', 'done'])[1 + floor(random() * 5)::int],
  (ARRAY['low', 'medium', 'high', 'urgent'])[1 + floor(random() * 4)::int],
  round((1 + random() * 80)::numeric, 2),
  now() - (random() * interval '540 days'),
  CASE WHEN random() < 0.8 THEN now() + (random() * interval '120 days') END
FROM generate_series(1, 120000) AS gs;

INSERT INTO work.task_comments (task_id, author_user_id, body, created_at)
SELECT
  1 + floor(random() * 120000)::bigint,
  1 + floor(random() * 500)::bigint,
  'Comment body ' || gs,
  now() - (random() * interval '540 days')
FROM generate_series(1, 250000) AS gs;

INSERT INTO audit.status_changes (
  entity_type, entity_id, old_status, new_status, changed_by, changed_at
)
SELECT
  (ARRAY['project', 'task'])[1 + floor(random() * 2)::int],
  1 + floor(random() * 120000)::bigint,
  (ARRAY['todo', 'in_progress', 'review', 'blocked', 'done'])[1 + floor(random() * 5)::int],
  (ARRAY['todo', 'in_progress', 'review', 'blocked', 'done'])[1 + floor(random() * 5)::int],
  1 + floor(random() * 500)::bigint,
  now() - (random() * interval '540 days')
FROM generate_series(1, 300000);

CREATE INDEX idx_contacts_organization_id ON crm.contacts(organization_id);
CREATE INDEX idx_projects_organization_id ON work.projects(organization_id);
CREATE INDEX idx_projects_owner_user_id ON work.projects(owner_user_id);
CREATE INDEX idx_tasks_project_id ON work.tasks(project_id);
CREATE INDEX idx_tasks_assignee_user_id ON work.tasks(assignee_user_id);
CREATE INDEX idx_tasks_status_due_at ON work.tasks(status, due_at);
CREATE INDEX idx_task_comments_task_id ON work.task_comments(task_id);
CREATE INDEX idx_status_changes_entity ON audit.status_changes(entity_type, entity_id);
CREATE INDEX idx_status_changes_changed_at ON audit.status_changes(changed_at DESC);

CREATE VIEW work.project_health AS
SELECT
  p.project_id,
  p.name,
  p.status,
  count(t.task_id)::integer AS tasks,
  count(t.task_id) FILTER (WHERE t.status = 'done')::integer AS done_tasks,
  count(t.task_id) FILTER (WHERE t.status = 'blocked')::integer AS blocked_tasks
FROM work.projects AS p
LEFT JOIN work.tasks AS t ON t.project_id = p.project_id
GROUP BY p.project_id, p.name, p.status;

ANALYZE;

\connect databara_finance

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA ledger;
CREATE SCHEMA billing;
CREATE SCHEMA reference;

CREATE TABLE reference.currencies (
  currency char(3) PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE reference.exchange_rates (
  rate_date date NOT NULL,
  currency char(3) NOT NULL REFERENCES reference.currencies(currency),
  usd_rate numeric(18, 8) NOT NULL,
  PRIMARY KEY (rate_date, currency)
);

CREATE TABLE ledger.accounts (
  account_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL,
  currency char(3) NOT NULL REFERENCES reference.currencies(currency),
  active boolean NOT NULL
);

CREATE TABLE ledger.transactions (
  transaction_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ledger.accounts(account_id),
  transaction_date date NOT NULL,
  amount numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL REFERENCES reference.currencies(currency),
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  memo text NOT NULL,
  attributes jsonb NOT NULL
);

CREATE TABLE billing.recurring_invoices (
  recurring_invoice_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ledger.accounts(account_id),
  customer_ref text NOT NULL,
  interval_months integer NOT NULL,
  amount numeric(14, 2) NOT NULL,
  next_run_date date NOT NULL,
  active boolean NOT NULL
);

CREATE TABLE ledger.budgets (
  budget_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ledger.accounts(account_id),
  fiscal_month date NOT NULL,
  budget_amount numeric(14, 2) NOT NULL,
  UNIQUE (account_id, fiscal_month)
);

INSERT INTO reference.currencies (currency, name)
VALUES ('USD', 'US Dollar'), ('CLP', 'Chilean Peso'), ('BRL', 'Brazilian Real'), ('MXN', 'Mexican Peso'), ('EUR', 'Euro');

INSERT INTO reference.exchange_rates (rate_date, currency, usd_rate)
SELECT
  day::date,
  c.currency,
  CASE c.currency
    WHEN 'USD' THEN 1
    WHEN 'CLP' THEN 850 + random() * 120
    WHEN 'BRL' THEN 4.7 + random()
    WHEN 'MXN' THEN 16 + random() * 4
    ELSE 0.85 + random() * 0.25
  END
FROM generate_series(current_date - 1095, current_date, interval '1 day') AS day
CROSS JOIN reference.currencies AS c;

INSERT INTO ledger.accounts (account_code, name, account_type, currency, active)
SELECT
  'ACCT-' || lpad(gs::text, 6, '0'),
  'Account ' || gs,
  (ARRAY['asset', 'liability', 'revenue', 'expense', 'equity'])[1 + floor(random() * 5)::int],
  (ARRAY['USD', 'CLP', 'BRL', 'MXN', 'EUR'])[1 + floor(random() * 5)::int],
  random() > 0.04
FROM generate_series(1, 20000) AS gs;

INSERT INTO ledger.transactions (
  account_id, transaction_date, amount, currency, direction, memo, attributes
)
SELECT
  1 + floor(random() * 20000)::bigint,
  current_date - floor(random() * 1095)::int,
  round((5 + random() * 25000)::numeric, 2),
  (ARRAY['USD', 'CLP', 'BRL', 'MXN', 'EUR'])[1 + floor(random() * 5)::int],
  (ARRAY['debit', 'credit'])[1 + floor(random() * 2)::int],
  'Transaction ' || gs,
  jsonb_build_object('source', (ARRAY['bank', 'card', 'manual', 'import'])[1 + floor(random() * 4)::int], 'batch_id', floor(random() * 5000)::int)
FROM generate_series(1, 300000) AS gs;

INSERT INTO billing.recurring_invoices (
  account_id, customer_ref, interval_months, amount, next_run_date, active
)
SELECT
  1 + floor(random() * 20000)::bigint,
  'customer-' || gs,
  (ARRAY[1, 3, 6, 12])[1 + floor(random() * 4)::int],
  round((20 + random() * 3000)::numeric, 2),
  current_date + floor(random() * 90)::int,
  random() > 0.12
FROM generate_series(1, 25000) AS gs;

INSERT INTO ledger.budgets (account_id, fiscal_month, budget_amount)
SELECT
  a.account_id,
  (date_trunc('month', current_date)::date - (month_offset || ' months')::interval)::date,
  round((1000 + random() * 100000)::numeric, 2)
FROM ledger.accounts AS a
CROSS JOIN generate_series(0, 11) AS month_offset
WHERE a.account_id <= 15000;

CREATE INDEX idx_transactions_account_id ON ledger.transactions(account_id);
CREATE INDEX idx_transactions_date ON ledger.transactions(transaction_date DESC);
CREATE INDEX idx_transactions_currency ON ledger.transactions(currency);
CREATE INDEX idx_recurring_invoices_next_run ON billing.recurring_invoices(next_run_date);
CREATE INDEX idx_budgets_month ON ledger.budgets(fiscal_month);

CREATE VIEW ledger.monthly_account_summary AS
SELECT
  account_id,
  date_trunc('month', transaction_date)::date AS fiscal_month,
  sum(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) AS net_amount,
  count(*)::integer AS transactions
FROM ledger.transactions
GROUP BY account_id, date_trunc('month', transaction_date)::date;

ANALYZE;

\connect databara_observability

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA metrics;
CREATE SCHEMA logs;
CREATE SCHEMA traces;

CREATE TABLE metrics.series (
  series_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service text NOT NULL,
  metric_name text NOT NULL,
  labels jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE metrics.samples (
  sample_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  series_id bigint NOT NULL REFERENCES metrics.series(series_id),
  sampled_at timestamptz NOT NULL,
  value numeric(14, 4) NOT NULL
);

CREATE TABLE logs.events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service text NOT NULL,
  level text NOT NULL,
  message text NOT NULL,
  context jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE traces.spans (
  span_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL,
  parent_span_id uuid,
  service text NOT NULL,
  operation text NOT NULL,
  duration_ms integer NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL
);

CREATE TABLE traces.errors (
  error_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  span_id uuid REFERENCES traces.spans(span_id),
  service text NOT NULL,
  error_type text NOT NULL,
  message text NOT NULL,
  occurred_at timestamptz NOT NULL
);

INSERT INTO metrics.series (service, metric_name, labels, created_at)
SELECT
  (ARRAY['api', 'worker', 'desktop-sync', 'query-runner', 'auth'])[1 + floor(random() * 5)::int],
  (ARRAY['cpu_usage', 'memory_mb', 'query_duration_ms', 'requests_total', 'queue_depth'])[1 + floor(random() * 5)::int],
  jsonb_build_object('region', (ARRAY['us-east', 'us-west', 'sa-east', 'eu-west'])[1 + floor(random() * 4)::int], 'instance', 'i-' || gs),
  now() - (random() * interval '90 days')
FROM generate_series(1, 5000) AS gs;

INSERT INTO metrics.samples (series_id, sampled_at, value)
SELECT
  1 + floor(random() * 5000)::bigint,
  now() - (random() * interval '30 days'),
  round((random() * 10000)::numeric, 4)
FROM generate_series(1, 400000);

INSERT INTO logs.events (service, level, message, context, created_at)
SELECT
  (ARRAY['api', 'worker', 'desktop-sync', 'query-runner', 'auth'])[1 + floor(random() * 5)::int],
  (ARRAY['debug', 'info', 'info', 'warn', 'error'])[1 + floor(random() * 5)::int],
  'Log event ' || gs,
  jsonb_build_object('request_id', gen_random_uuid(), 'duration_ms', floor(random() * 5000)::int),
  now() - (random() * interval '30 days')
FROM generate_series(1, 500000) AS gs;

INSERT INTO traces.spans (
  trace_id, service, operation, duration_ms, status, started_at
)
SELECT
  gen_random_uuid(),
  (ARRAY['api', 'worker', 'desktop-sync', 'query-runner', 'auth'])[1 + floor(random() * 5)::int],
  (ARRAY['connect', 'introspect', 'run_query', 'export_csv', 'refresh'])[1 + floor(random() * 5)::int],
  1 + floor(random() * 15000)::int,
  (ARRAY['ok', 'ok', 'ok', 'error', 'timeout'])[1 + floor(random() * 5)::int],
  now() - (random() * interval '30 days')
FROM generate_series(1, 150000);

INSERT INTO traces.errors (span_id, service, error_type, message, occurred_at)
SELECT
  span_id,
  service,
  (ARRAY['DatabaseError', 'TimeoutError', 'ValidationError', 'NetworkError'])[1 + floor(random() * 4)::int],
  'Error captured for ' || operation,
  started_at + (random() * interval '10 seconds')
FROM traces.spans
WHERE status <> 'ok'
ORDER BY random()
LIMIT 25000;

CREATE INDEX idx_metric_samples_series_time ON metrics.samples(series_id, sampled_at DESC);
CREATE INDEX idx_metric_samples_time ON metrics.samples(sampled_at DESC);
CREATE INDEX idx_logs_events_service_time ON logs.events(service, created_at DESC);
CREATE INDEX idx_logs_events_level ON logs.events(level);
CREATE INDEX idx_spans_trace_id ON traces.spans(trace_id);
CREATE INDEX idx_spans_service_started ON traces.spans(service, started_at DESC);
CREATE INDEX idx_errors_service_time ON traces.errors(service, occurred_at DESC);

CREATE VIEW logs.error_rate_by_service AS
SELECT
  service,
  date_trunc('hour', created_at) AS hour,
  count(*) FILTER (WHERE level = 'error')::integer AS errors,
  count(*)::integer AS total_events
FROM logs.events
GROUP BY service, date_trunc('hour', created_at);

ANALYZE;
