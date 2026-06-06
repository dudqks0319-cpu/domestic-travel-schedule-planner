-- TripMate v1.0 operational observability events.
-- Store endpoint/provider health signals without raw request bodies, tokens, coordinates, or provider payloads.

CREATE TABLE IF NOT EXISTS operational_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operational_events_target_created ON operational_events(target, created_at);
