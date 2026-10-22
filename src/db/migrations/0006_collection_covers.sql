ALTER TABLE collections ADD COLUMN icon TEXT;
ALTER TABLE collections ADD COLUMN cover_type TEXT CHECK(cover_type IS NULL OR cover_type IN ('item_photo', 'upload', 'emoji', 'default'));
ALTER TABLE collections ADD COLUMN cover_icon TEXT;
ALTER TABLE collections ADD COLUMN cover_item_id TEXT;
ALTER TABLE collections ADD COLUMN cover_media_id TEXT;
ALTER TABLE collections ADD COLUMN cover_upload_id TEXT;

CREATE TABLE collection_cover_assets (
  id TEXT PRIMARY KEY NOT NULL,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL CHECK(width > 0),
  height INTEGER NOT NULL CHECK(height > 0),
  created_at TEXT NOT NULL
);

CREATE INDEX collection_cover_assets_collection_idx ON collection_cover_assets(collection_id, created_at DESC);
