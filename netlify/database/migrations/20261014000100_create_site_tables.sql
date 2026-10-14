CREATE TABLE IF NOT EXISTS site_documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS site_documents_collection_updated
  ON site_documents (collection, updated_at DESC);
