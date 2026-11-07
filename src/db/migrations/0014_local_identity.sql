CREATE TABLE auth_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1)),
  disabled INTEGER NOT NULL DEFAULT 1 CHECK(disabled IN (0,1)),
  created_at TEXT NOT NULL
);
INSERT INTO auth_users(id,is_admin,created_at) VALUES('00000000-0000-4000-8000-000000000010',1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE inventory_owners (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT
);
CREATE INDEX inventory_owners_user ON inventory_owners(user_id,workspace_id);
INSERT INTO inventory_owners(workspace_id,user_id) SELECT id,'00000000-0000-4000-8000-000000000010' FROM workspaces;
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_login_buckets (
  bucket TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
