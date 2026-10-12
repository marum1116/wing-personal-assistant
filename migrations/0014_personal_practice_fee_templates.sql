CREATE TABLE IF NOT EXISTS personal_practice_fee_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_key TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_active INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  instruction_fee_per_person INTEGER NOT NULL,
  escort_fee_per_shimura_direction INTEGER NOT NULL,
  facility_fee_mode TEXT NOT NULL,
  facility_fee_amount INTEGER,
  highway_fee_mode TEXT NOT NULL,
  highway_fee_round_trip INTEGER,
  parking_fee_mode TEXT NOT NULL,
  parking_fee_amount INTEGER,
  deferred_note TEXT,
  blocks_completion_note TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (facility_key, version)
);

CREATE TABLE IF NOT EXISTS personal_practice_fee_template_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  variant_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  UNIQUE (template_id, variant_key)
);

CREATE TABLE IF NOT EXISTS personal_confirmed_slot_fee_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL,
  fee_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  amount INTEGER,
  note TEXT,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (slot_id, fee_type)
);

CREATE INDEX IF NOT EXISTS idx_personal_fee_templates_facility
ON personal_practice_fee_templates (facility_key, is_active, valid_from);

CREATE INDEX IF NOT EXISTS idx_personal_slot_fee_overrides_slot
ON personal_confirmed_slot_fee_overrides (slot_id);

-- Current templates only. valid_from is the implementation date.
-- Older practice dates must not pick these rows.
INSERT INTO personal_practice_fee_templates (
  facility_key, facility_name, version, is_active, valid_from,
  instruction_fee_per_person, escort_fee_per_shimura_direction,
  facility_fee_mode, facility_fee_amount,
  highway_fee_mode, highway_fee_round_trip,
  parking_fee_mode, parking_fee_amount,
  deferred_note, blocks_completion_note, source, created_at
) VALUES
  ('sugita', '菅田地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 500, 'round_trip', 420, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('shirogo', '城郷小机地区センター', 1, 1, '2026-10-12', 1500, 100, 'unresolved', NULL, 'round_trip', 420, 'none', NULL, NULL, '日祝の2時間料金と通常料金を日付だけでは一意に分けられないため、施設費は自動確定しません。', 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('kamitaiji', '神大寺地区センター', 1, 1, '2026-10-12', 1500, 100, 'by_duration_hours', NULL, 'round_trip', 680, 'uncertain', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('kaminakazato', '上中里地区センター', 1, 1, '2026-10-12', 1500, 100, 'by_duration_hours', NULL, 'round_trip', 2140, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('nagaya', '永谷地区センター', 1, 1, '2026-10-12', 1500, 100, 'by_court_label', NULL, 'round_trip', 1320, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('shinohara', '篠原地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 900, 'round_trip', 680, 'fixed', 700, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('okuma', '大熊スポーツセンター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 0, 'round_trip', 260, 'none', NULL, NULL, '抽選申込に行った人の交通費・ガソリン代は自動確定しません。', 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('sueyoshi', '末吉地区センター', 1, 1, '2026-10-12', 1500, 100, 'per_court_count', 360, 'none', 0, 'uncertain', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('kitayamada', '北山田地区センター', 1, 1, '2026-10-12', 1500, 100, 'per_court_count', 580, 'round_trip', 260, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('nakahara', '中原支援学校', 1, 1, '2026-10-12', 1500, 100, 'deferred', NULL, 'none', 0, 'none', NULL, '※設備費等は後日精算となります。', NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('nakamachidai', '仲町台地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 630, 'round_trip', 260, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('shirahata', '白幡地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 600, 'round_trip', 1040, 'uncertain', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('terao', '寺尾地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 420, 'round_trip', 420, 'uncertain', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('higashinagaya', '東永谷地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 640, 'round_trip', 1320, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('ichizawa', '市沢地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 670, 'round_trip', 680, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('noba', '野庭地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 640, 'round_trip', 1320, 'none', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z'),
  ('kamariya', '釜利谷地区センター', 1, 1, '2026-10-12', 1500, 100, 'fixed', 600, 'round_trip', 2520, 'uncertain', NULL, NULL, NULL, 'line_note_current', '2026-10-12T00:00:00.000Z');

INSERT INTO personal_practice_fee_template_variants (template_id, variant_key, amount)
SELECT id, 'duration:2', 400 FROM personal_practice_fee_templates WHERE facility_key = 'kamitaiji' AND version = 1;
INSERT INTO personal_practice_fee_template_variants (template_id, variant_key, amount)
SELECT id, 'duration:3', 600 FROM personal_practice_fee_templates WHERE facility_key = 'kamitaiji' AND version = 1;
INSERT INTO personal_practice_fee_template_variants (template_id, variant_key, amount)
SELECT id, 'duration:2', 400 FROM personal_practice_fee_templates WHERE facility_key = 'kaminakazato' AND version = 1;
INSERT INTO personal_practice_fee_template_variants (template_id, variant_key, amount)
SELECT id, 'court:A', 660 FROM personal_practice_fee_templates WHERE facility_key = 'nagaya' AND version = 1;
INSERT INTO personal_practice_fee_template_variants (template_id, variant_key, amount)
SELECT id, 'court:B', 540 FROM personal_practice_fee_templates WHERE facility_key = 'nagaya' AND version = 1;
INSERT INTO personal_practice_fee_template_variants (template_id, variant_key, amount)
SELECT id, 'court:C', 630 FROM personal_practice_fee_templates WHERE facility_key = 'nagaya' AND version = 1;
