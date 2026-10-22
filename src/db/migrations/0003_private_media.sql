CREATE TABLE media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK(mime_type = 'image/webp'),
  width INTEGER NOT NULL CHECK(width > 0),
  height INTEGER NOT NULL CHECK(height > 0),
  created_at TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK(is_primary IN (0, 1))
);

CREATE INDEX media_assets_item_created_idx ON media_assets(item_id, created_at DESC);
CREATE UNIQUE INDEX media_assets_one_primary_per_item_idx ON media_assets(item_id) WHERE is_primary = 1;
