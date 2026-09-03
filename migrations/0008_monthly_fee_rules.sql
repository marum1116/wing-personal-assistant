CREATE TABLE IF NOT EXISTS monthly_fee_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  payment_date TEXT NOT NULL,
  payee TEXT,
  payment_method TEXT,
  note_guidance TEXT,
  source TEXT NOT NULL,
  received_at TEXT NOT NULL,
  note_reminder_sent_on TEXT,
  note_recorded_at TEXT,
  circle_count INTEGER NOT NULL DEFAULT 0,
  triangle_count INTEGER NOT NULL DEFAULT 0,
  cross_count INTEGER NOT NULL DEFAULT 0,
  unknown_count INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  note_required INTEGER NOT NULL DEFAULT 0,
  memo_text TEXT NOT NULL,
  payment_reminder_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (year_month, version)
);

CREATE INDEX IF NOT EXISTS idx_monthly_fee_rules_active
ON monthly_fee_rules (year_month, is_active, version DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_fee_rules_payment_date
ON monthly_fee_rules (is_active, payment_date);

CREATE TABLE IF NOT EXISTS monthly_fee_weekday_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  weekday_code TEXT NOT NULL CHECK (weekday_code IN ('mon','tue','wed','thu','fri','sat','sun')),
  unit_price INTEGER NOT NULL,
  group_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (rule_id, weekday_code)
);

CREATE INDEX IF NOT EXISTS idx_monthly_fee_weekday_rates_rule
ON monthly_fee_weekday_rates (rule_id, group_order, weekday_code);

CREATE TABLE IF NOT EXISTS monthly_fee_extra_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monthly_fee_extra_charges_rule
ON monthly_fee_extra_charges (rule_id, item_order, id);
