CREATE TABLE IF NOT EXISTS practices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  practice_date TEXT NOT NULL UNIQUE,
  attendance TEXT NOT NULL,
  outbound_type TEXT NOT NULL,
  outbound_person TEXT,
  return_type TEXT NOT NULL,
  return_person TEXT,
  bus_guide TEXT,
  source TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  practice_date TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  amount INTEGER,
  payee TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  billing_scope TEXT NOT NULL CHECK (billing_scope IN ('event', 'monthly', 'other')),
  direction TEXT NOT NULL DEFAULT 'none' CHECK (direction IN ('outbound', 'return', 'none')),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_event_unique
ON payments (
  practice_date,
  payment_type,
  IFNULL(amount, -1),
  IFNULL(payee, ''),
  direction
)
WHERE billing_scope = 'event';
