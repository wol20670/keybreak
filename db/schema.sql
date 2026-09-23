-- KEYBREAK score table.
-- Run once against your Neon database (Neon Console -> SQL Editor, or psql).

CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR(20) NOT NULL,
  dpm INTEGER NOT NULL,
  total_hits INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matches the ranking query: ORDER BY dpm DESC, created_at ASC LIMIT 20.
CREATE INDEX IF NOT EXISTS scores_rank_idx ON scores (dpm DESC, created_at ASC);
