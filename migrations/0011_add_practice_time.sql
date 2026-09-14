ALTER TABLE practices ADD COLUMN practice_time TEXT;
ALTER TABLE practices ADD COLUMN practice_time_priority INTEGER NOT NULL DEFAULT 0;
