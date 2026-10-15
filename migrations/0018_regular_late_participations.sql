CREATE TABLE IF NOT EXISTS regular_late_participations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  practice_date TEXT NOT NULL UNIQUE,
  recorded_at TEXT NOT NULL,
  source TEXT NOT NULL,
  payment_id INTEGER,
  reminder_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_regular_late_participations_payment
ON regular_late_participations (payment_id);
