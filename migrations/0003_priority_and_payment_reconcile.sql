ALTER TABLE practices ADD COLUMN practice_type TEXT;
ALTER TABLE practices ADD COLUMN practice_type_basis TEXT;
ALTER TABLE practices ADD COLUMN practice_type_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN attendance_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN outbound_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN return_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN bus_guide_priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practices ADD COLUMN last_message_kind TEXT;

ALTER TABLE payments ADD COLUMN rule_key TEXT;
ALTER TABLE payments ADD COLUMN voided_at TEXT;
ALTER TABLE payments ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN review_reason TEXT;

UPDATE payments
SET rule_key = 'transport:outbound:car'
WHERE rule_key IS NULL
  AND billing_scope = 'event'
  AND payment_type = '車同乗代'
  AND direction = 'outbound';

UPDATE payments
SET rule_key = 'transport:return:car'
WHERE rule_key IS NULL
  AND billing_scope = 'event'
  AND payment_type = '車同乗代'
  AND direction = 'return';

UPDATE payments
SET rule_key = 'transport:return:bus'
WHERE rule_key IS NULL
  AND billing_scope = 'event'
  AND payment_type = 'バス引率代'
  AND direction = 'return';
