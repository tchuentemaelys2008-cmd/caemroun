-- ============================================================
--  Petition "Protegeons Nos Enfants" — schema PostgreSQL
--  A executer une seule fois sur la base Railway.
-- ============================================================

CREATE TABLE IF NOT EXISTS signatures (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,          -- 'Citoyen Anonyme' si anonyme
  city        TEXT DEFAULT '',
  is_anon     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour récupérer rapidement les derniers signataires
CREATE INDEX IF NOT EXISTS idx_signatures_created_at
  ON signatures (created_at DESC);
