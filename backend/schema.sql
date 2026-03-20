DROP TABLE IF EXISTS eco_logs;
CREATE TABLE eco_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  original_tokens INTEGER NOT NULL,
  compressed_tokens INTEGER NOT NULL
);
