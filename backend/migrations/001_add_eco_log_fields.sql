CREATE TABLE IF NOT EXISTS eco_logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  original_tokens INTEGER NOT NULL,
  compressed_tokens INTEGER NOT NULL
);

INSERT INTO eco_logs_new (id, user_id, tokens, original_tokens, compressed_tokens)
SELECT
  id,
  'legacy',
  COALESCE(tokens, 0),
  0,
  0
FROM eco_logs;

DROP TABLE eco_logs;
ALTER TABLE eco_logs_new RENAME TO eco_logs;
