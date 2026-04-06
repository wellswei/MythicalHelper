CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  watch_over TEXT NOT NULL,
  realms_json TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  verify_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_access_token ON records(access_token);
CREATE INDEX IF NOT EXISTS idx_records_verify_token ON records(verify_token);
CREATE INDEX IF NOT EXISTS idx_records_email_normalized ON records(email_normalized);

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_magic_links_record_id ON magic_links(record_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_email_normalized ON magic_links(email_normalized);
