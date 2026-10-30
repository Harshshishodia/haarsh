-- Applied idempotently by server/db.ts.
-- Adds gallery_albums, gallery_items and gallery_consents.
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(11,'private_gallery');
