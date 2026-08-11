CREATE TABLE IF NOT EXISTS monthly_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billing_month TEXT NOT NULL,
  monthly_type TEXT NOT NULL CHECK (monthly_type IN ('regular_training_total', 'shimura_car_fee')),
  amount INTEGER NOT NULL,
  payee TEXT,
  due_date TEXT,
  payment_method TEXT,
  breakdown_text TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  source TEXT NOT NULL,
  reminder_sent_on TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  review_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (billing_month, monthly_type)
);

CREATE INDEX IF NOT EXISTS idx_monthly_payments_status_due_date
ON monthly_payments (status, due_date);
