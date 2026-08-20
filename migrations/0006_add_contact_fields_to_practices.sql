ALTER TABLE practices ADD COLUMN meeting_time TEXT;
ALTER TABLE practices ADD COLUMN meeting_place TEXT;
ALTER TABLE practices ADD COLUMN outbound_companions TEXT;
ALTER TABLE practices ADD COLUMN return_dropoff_place TEXT;
ALTER TABLE practices ADD COLUMN return_release_place TEXT;

ALTER TABLE practices ADD COLUMN meeting_time_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN meeting_place_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN outbound_companions_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN return_dropoff_place_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN return_release_place_priority INTEGER NOT NULL DEFAULT 0;
