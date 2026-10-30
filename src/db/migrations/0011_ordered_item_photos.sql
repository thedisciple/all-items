ALTER TABLE media_assets ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CHECK(display_order >= 0);

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY created_at, id) - 1 AS position
  FROM media_assets
)
UPDATE media_assets SET display_order = (SELECT position FROM ordered WHERE ordered.id = media_assets.id);

-- Preserve valid legacy primary choices; repair a gallery without a primary.
UPDATE media_assets SET is_primary = 1
WHERE display_order = 0 AND item_id NOT IN (SELECT item_id FROM media_assets WHERE is_primary = 1);

CREATE UNIQUE INDEX media_assets_item_order_idx ON media_assets(item_id, display_order);
