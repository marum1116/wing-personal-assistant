CREATE TABLE IF NOT EXISTS personal_slot_receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL,
  participant_name TEXT NOT NULL,
  expected_amount INTEGER,
  received_at TEXT,
  received_amount INTEGER,
  status TEXT NOT NULL,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (slot_id, participant_name)
);

CREATE INDEX IF NOT EXISTS idx_personal_slot_receivables_slot
ON personal_slot_receivables (slot_id);
