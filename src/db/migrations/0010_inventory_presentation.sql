CREATE TABLE inventory_preferences (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version = 1),
  sort TEXT NOT NULL DEFAULT 'date' CHECK(sort IN ('date', 'name', 'quantity'))
);

CREATE TABLE custom_category_presentation (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  emoji TEXT NOT NULL,
  PRIMARY KEY(workspace_id, category)
);
