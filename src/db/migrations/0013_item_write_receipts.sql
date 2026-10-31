-- Installation-local retry identities; these are deliberately not portable records.
CREATE TABLE item_write_receipts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('item_create','photo_add','photo_replace')),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  inventory_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,operation_id)
);

CREATE TRIGGER item_write_receipts_owned_insert BEFORE INSERT ON item_write_receipts
WHEN NEW.item_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM items WHERE id=NEW.item_id AND workspace_id=NEW.workspace_id)
  OR (NEW.media_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM media_assets WHERE id=NEW.media_id AND item_id=NEW.item_id))
  OR (NEW.kind!='item_create' AND NEW.media_id IS NULL)
BEGIN SELECT RAISE(ABORT,'Invalid write receipt ownership'); END;

-- Foreign-key nulling is allowed; a deleted result must never be resurrected by retry.
CREATE TRIGGER item_write_receipts_immutable BEFORE UPDATE ON item_write_receipts
WHEN NEW.workspace_id!=OLD.workspace_id OR NEW.operation_id!=OLD.operation_id
  OR NEW.kind!=OLD.kind OR NEW.request_hash!=OLD.request_hash
  OR NEW.inventory_number!=OLD.inventory_number OR NEW.created_at!=OLD.created_at
  OR (NEW.item_id IS NOT NULL AND NEW.item_id IS NOT OLD.item_id)
  OR (NEW.media_id IS NOT NULL AND NEW.media_id IS NOT OLD.media_id)
BEGIN SELECT RAISE(ABORT,'Write receipt identity is immutable'); END;
