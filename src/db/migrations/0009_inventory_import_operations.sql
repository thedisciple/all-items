-- This marker is committed in the same transaction as a newly imported inventory.
CREATE TABLE inventory_import_operations (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX inventory_import_operations_workspace_idx ON inventory_import_operations(workspace_id);
