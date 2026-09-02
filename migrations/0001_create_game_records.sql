CREATE TABLE IF NOT EXISTS game_records (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('default', 'countdown', 'stopwatch')),
  score INTEGER NOT NULL CHECK (score >= 0),
  total_score INTEGER NOT NULL CHECK (total_score >= 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  ended_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_records_client_created
  ON game_records(client_id, created_at DESC);
