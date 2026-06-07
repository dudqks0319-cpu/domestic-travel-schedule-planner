UPDATE share_links
SET expires_at = datetime(COALESCE(created_at, datetime('now')), '+30 days'),
    updated_at = datetime('now')
WHERE expires_at IS NULL
  AND deleted_at IS NULL;

UPDATE share_links
SET status = 'expired',
    updated_at = datetime('now')
WHERE expires_at IS NOT NULL
  AND expires_at <= datetime('now')
  AND status = 'active'
  AND deleted_at IS NULL;
