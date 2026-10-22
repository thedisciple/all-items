ALTER TABLE workspaces ADD COLUMN next_inventory_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE items ADD COLUMN inventory_number TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN brand TEXT;
ALTER TABLE items ADD COLUMN category TEXT;
ALTER TABLE items ADD COLUMN original_marking TEXT;
ALTER TABLE items ADD COLUMN notes TEXT;
ALTER TABLE items ADD COLUMN description TEXT;
ALTER TABLE items ADD COLUMN identification_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE items ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT 'unique';
ALTER TABLE items ADD COLUMN sale_intent TEXT NOT NULL DEFAULT 'not_for_sale';
ALTER TABLE items ADD COLUMN asking_price_minor INTEGER;
ALTER TABLE items ADD COLUMN asking_currency TEXT;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at ASC, id ASC) AS sequence
  FROM items
)
UPDATE items
SET inventory_number = 'INV-' || printf('%06d', (SELECT sequence FROM ranked WHERE ranked.id = items.id));

UPDATE workspaces
SET next_inventory_number = COALESCE(
  (SELECT MAX(CAST(SUBSTR(inventory_number, 5) AS INTEGER)) + 1 FROM items WHERE items.workspace_id = workspaces.id),
  1
);

CREATE UNIQUE INDEX items_workspace_inventory_number_idx ON items(workspace_id, inventory_number);
CREATE INDEX items_workspace_category_idx ON items(workspace_id, category);
CREATE INDEX items_workspace_status_idx ON items(workspace_id, identification_status);

CREATE TABLE locations (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, name)
);

CREATE TABLE stock_entries (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK(quantity >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX stock_item_location_idx ON stock_entries(item_id, COALESCE(location_id, ''));

INSERT INTO stock_entries (id, item_id, location_id, quantity, created_at, updated_at)
SELECT id, id, NULL, 1, created_at, updated_at FROM items;
