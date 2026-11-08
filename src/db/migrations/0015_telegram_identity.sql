CREATE TABLE auth_external_identities (
  provider TEXT NOT NULL CHECK(provider='telegram'),
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  linked_at INTEGER NOT NULL,
  PRIMARY KEY(provider,issuer,subject)
);
CREATE INDEX auth_external_identities_user ON auth_external_identities(user_id);
CREATE UNIQUE INDEX auth_external_identities_one_provider_per_user ON auth_external_identities(provider,user_id);
CREATE TABLE auth_telegram_invites (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX auth_telegram_invites_username ON auth_telegram_invites(username);
CREATE TABLE auth_oidc_flows (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  intent TEXT NOT NULL CHECK(intent IN ('login','invite','link')),
  invite_hash TEXT REFERENCES auth_telegram_invites(token_hash),
  user_id TEXT REFERENCES auth_users(id),
  session_hash TEXT,
  status TEXT NOT NULL CHECK(status IN ('started','exchanging','pending')),
  subject TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_oidc_flows_expiry ON auth_oidc_flows(expires_at);
