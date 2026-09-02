CREATE INDEX IF NOT EXISTS idx_game_records_leaderboard
  ON game_records(score DESC, duration_seconds ASC, created_at DESC);
