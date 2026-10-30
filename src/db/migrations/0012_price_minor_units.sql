-- Existing prices were stored in hundredths, including historical unknown codes.
-- Pin their meaning independently of later ISO/Intl display-data changes.
ALTER TABLE items ADD COLUMN asking_price_exponent INTEGER NOT NULL DEFAULT 2 CHECK(asking_price_exponent BETWEEN 0 AND 3);
