CREATE TABLE IF NOT EXISTS personal_slot_payment_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL UNIQUE,
  payee_name TEXT NOT NULL,
  payee_source TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_method_source TEXT NOT NULL,
  participant_amount INTEGER,
  total_amount INTEGER,
  fee_breakdown_json TEXT NOT NULL,
  court_or_area TEXT,
  source_type TEXT NOT NULL,
  source_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personal_slot_payment_notices_slot
ON personal_slot_payment_notices (slot_id);
