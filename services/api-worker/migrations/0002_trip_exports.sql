-- TripMate v1.0 export preparation records.
-- Final PDF/image files can be generated asynchronously from the stored R2 manifest.

CREATE TABLE IF NOT EXISTS trip_exports (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  user_id TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  manifest_key TEXT NOT NULL,
  asset_key TEXT,
  error_code TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_exports_trip ON trip_exports(trip_id, user_id, status, deleted_at);
