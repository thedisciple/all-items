CREATE TABLE collections (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX collections_workspace_name_idx ON collections(workspace_id, normalized_name);
CREATE INDEX collections_workspace_created_idx ON collections(workspace_id, created_at DESC);

CREATE TABLE item_collection_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(item_id, collection_id)
);

CREATE INDEX item_collection_memberships_collection_idx ON item_collection_memberships(collection_id, item_id);
CREATE INDEX item_collection_memberships_item_idx ON item_collection_memberships(item_id, collection_id);

CREATE TRIGGER item_collection_memberships_workspace_insert
BEFORE INSERT ON item_collection_memberships
WHEN NOT EXISTS (
  SELECT 1 FROM items i JOIN collections c ON c.id = NEW.collection_id
  WHERE i.id = NEW.item_id AND i.workspace_id = c.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'item and collection must belong to the same workspace');
END;

CREATE TRIGGER item_collection_memberships_workspace_update
BEFORE UPDATE OF item_id, collection_id ON item_collection_memberships
WHEN NOT EXISTS (
  SELECT 1 FROM items i JOIN collections c ON c.id = NEW.collection_id
  WHERE i.id = NEW.item_id AND i.workspace_id = c.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'item and collection must belong to the same workspace');
END;
