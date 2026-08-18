-- VALI V4 Migration
-- Driver approval + plate normalization + financial improvements

-- 1) Add plate status to drivers
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS plate_status TEXT
DEFAULT 'pending'
CHECK (plate_status IN ('pending','active','rejected'));

-- 2) Add normalized plate for duplicate prevention
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS normalized_plate TEXT;

-- 3) Normalize existing plates
UPDATE drivers
SET normalized_plate = UPPER(REPLACE(truck_number,' ',''))
WHERE normalized_plate IS NULL;

-- 4) Prevent duplicate plates
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_normalized_plate_unique
ON drivers(normalized_plate);

-- 5) Add driver relation to expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS driver_id BIGINT
REFERENCES drivers(id);

-- 6) Update transaction types
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions
ADD CONSTRAINT transactions_type_check
CHECK (type IN ('payment','receipt','expense'));

-- 7) Search indexes
CREATE INDEX IF NOT EXISTS idx_drivers_plate_search
ON drivers(normalized_plate);

CREATE INDEX IF NOT EXISTS idx_expenses_driver
ON expenses(driver_id);

-- 8) Timestamp defaults
ALTER TABLE drivers
ALTER COLUMN updated_at
SET DEFAULT NOW();

ALTER TABLE expenses
ALTER COLUMN updated_at
SET DEFAULT NOW();

ALTER TABLE transactions
ALTER COLUMN updated_at
SET DEFAULT NOW();
