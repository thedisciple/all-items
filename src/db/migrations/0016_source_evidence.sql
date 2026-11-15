ALTER TABLE items ADD COLUMN source_evidence TEXT;
CREATE TRIGGER invalidate_source_evidence AFTER UPDATE OF brand,model,original_marking ON items
WHEN OLD.source_evidence IS NOT NULL AND (NEW.brand IS NOT OLD.brand OR NEW.model IS NOT OLD.model OR NEW.original_marking IS NOT OLD.original_marking)
BEGIN
 UPDATE items SET source_evidence=NULL, identification_status='user_confirmed' WHERE id=NEW.id;
END;
