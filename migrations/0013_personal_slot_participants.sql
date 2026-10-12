CREATE TABLE IF NOT EXISTS personal_confirmed_slot_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL,
  participant_order INTEGER NOT NULL,
  participant_name TEXT NOT NULL,
  outbound_transport TEXT NOT NULL,
  outbound_source TEXT NOT NULL,
  return_transport TEXT NOT NULL,
  return_source TEXT NOT NULL,
  escort_fee_override TEXT,
  escort_fee_override_reason TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (slot_id, participant_order)
);

CREATE INDEX IF NOT EXISTS idx_personal_slot_participants_slot
ON personal_confirmed_slot_participants (slot_id);

ALTER TABLE personal_confirmed_slots ADD COLUMN deferred_fee_note TEXT;
