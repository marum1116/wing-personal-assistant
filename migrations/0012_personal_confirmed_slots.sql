CREATE TABLE IF NOT EXISTS personal_confirmed_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  practice_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  practice_location TEXT,
  participant_names_json TEXT NOT NULL,
  meeting_time TEXT,
  meeting_place TEXT,
  court_or_area TEXT,
  notes TEXT,
  coordinator_name TEXT NOT NULL,
  rui_participates INTEGER NOT NULL,
  watanabe_is_coordinator INTEGER NOT NULL,
  source TEXT NOT NULL,
  coordinator_reminder_sent_at TEXT,
  payment_reminder_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_confirmed_slots_date_start
ON personal_confirmed_slots (practice_date, start_time);
