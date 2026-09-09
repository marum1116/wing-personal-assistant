CREATE TABLE IF NOT EXISTS lead_check_decisions (
  practice_date TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL,
  auto_candidate TEXT NOT NULL CHECK (auto_candidate IN ('available', 'unavailable', 'unknown')),
  auto_reason TEXT,
  human_status TEXT CHECK (human_status IS NULL OR human_status IN ('available', 'unavailable')),
  source TEXT CHECK (source IS NULL OR source IN ('html', 'command')),
  confirmed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_check_decisions_billing_month
ON lead_check_decisions (billing_month);
