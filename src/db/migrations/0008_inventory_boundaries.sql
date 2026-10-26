-- Initialize a fresh installation once. Reading an inventory never recreates it.
INSERT OR IGNORE INTO workspaces(id,name,created_at,next_inventory_number)
VALUES('00000000-0000-4000-8000-000000000001','Inventory',strftime('%Y-%m-%dT%H:%M:%fZ','now'),1);

CREATE TRIGGER items_identity_immutable BEFORE UPDATE OF workspace_id,inventory_number ON items
WHEN NEW.workspace_id <> OLD.workspace_id OR NEW.inventory_number <> OLD.inventory_number
BEGIN SELECT RAISE(ABORT,'item inventory identity is immutable'); END;
CREATE TRIGGER collections_inventory_immutable BEFORE UPDATE OF workspace_id ON collections
WHEN NEW.workspace_id <> OLD.workspace_id
BEGIN SELECT RAISE(ABORT,'collection inventory is immutable'); END;
CREATE TRIGGER locations_inventory_immutable BEFORE UPDATE OF workspace_id ON locations
WHEN NEW.workspace_id <> OLD.workspace_id
BEGIN SELECT RAISE(ABORT,'location inventory is immutable'); END;
CREATE TRIGGER media_owner_immutable BEFORE UPDATE OF item_id ON media_assets
WHEN NEW.item_id <> OLD.item_id
BEGIN SELECT RAISE(ABORT,'media owner is immutable'); END;
CREATE TRIGGER cover_owner_immutable BEFORE UPDATE OF collection_id ON collection_cover_assets
WHEN NEW.collection_id <> OLD.collection_id
BEGIN SELECT RAISE(ABORT,'cover owner is immutable'); END;
CREATE TRIGGER inventory_sequence_monotonic BEFORE UPDATE OF next_inventory_number ON workspaces
WHEN NEW.next_inventory_number < OLD.next_inventory_number
BEGIN SELECT RAISE(ABORT,'inventory numbers cannot be reused'); END;

CREATE TRIGGER stock_inventory_insert BEFORE INSERT ON stock_entries
WHEN NEW.location_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM items i JOIN locations l ON l.id=NEW.location_id WHERE i.id=NEW.item_id AND i.workspace_id=l.workspace_id)
BEGIN SELECT RAISE(ABORT,'stock location belongs to another inventory'); END;
CREATE TRIGGER stock_inventory_update BEFORE UPDATE OF item_id,location_id ON stock_entries
WHEN NEW.location_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM items i JOIN locations l ON l.id=NEW.location_id WHERE i.id=NEW.item_id AND i.workspace_id=l.workspace_id)
BEGIN SELECT RAISE(ABORT,'stock location belongs to another inventory'); END;

CREATE TRIGGER collection_cover_inventory_insert BEFORE INSERT ON collections
WHEN (NEW.cover_type='item_photo' AND NOT EXISTS(SELECT 1 FROM items i JOIN media_assets m ON m.item_id=i.id WHERE i.id=NEW.cover_item_id AND m.id=NEW.cover_media_id AND i.workspace_id=NEW.workspace_id))
 OR (NEW.cover_type='upload' AND NOT EXISTS(SELECT 1 FROM collection_cover_assets ca WHERE ca.id=NEW.cover_upload_id AND ca.collection_id=NEW.id))
BEGIN SELECT RAISE(ABORT,'cover belongs to another inventory or owner'); END;

CREATE TRIGGER clear_deleted_photo_cover AFTER DELETE ON media_assets
BEGIN UPDATE collections SET cover_type='default',cover_item_id=NULL,cover_media_id=NULL,cover_upload_id=NULL WHERE cover_media_id=OLD.id; END;
CREATE TRIGGER clear_removed_member_cover AFTER DELETE ON item_collection_memberships
BEGIN UPDATE collections SET cover_type='default',cover_item_id=NULL,cover_media_id=NULL,cover_upload_id=NULL WHERE id=OLD.collection_id AND cover_item_id=OLD.item_id; END;
CREATE TRIGGER collection_cover_inventory_update BEFORE UPDATE OF cover_type,cover_item_id,cover_media_id,cover_upload_id ON collections
WHEN (NEW.cover_type='item_photo' AND NOT EXISTS(SELECT 1 FROM items i JOIN media_assets m ON m.item_id=i.id WHERE i.id=NEW.cover_item_id AND m.id=NEW.cover_media_id AND i.workspace_id=NEW.workspace_id))
 OR (NEW.cover_type='upload' AND NOT EXISTS(SELECT 1 FROM collection_cover_assets ca WHERE ca.id=NEW.cover_upload_id AND ca.collection_id=NEW.id))
BEGIN SELECT RAISE(ABORT,'cover belongs to another inventory or owner'); END;
