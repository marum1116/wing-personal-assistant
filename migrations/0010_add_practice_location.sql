ALTER TABLE practices ADD COLUMN practice_location TEXT;
ALTER TABLE practices ADD COLUMN practice_location_priority INTEGER NOT NULL DEFAULT 0;
