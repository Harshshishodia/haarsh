BEGIN;
CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('everyone','event','side','announcements')), event_tag TEXT, side TEXT, posting_role TEXT NOT NULL DEFAULT 'guest', frozen INTEGER NOT NULL DEFAULT 0 CHECK(frozen IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS channel_members (channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)), joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(channel_id,guest_id));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, client_message_id TEXT NOT NULL, message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','image','voice','system')), body TEXT NOT NULL DEFAULT '', media_key TEXT, reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','deleted')), pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, edited_at TEXT, deleted_at TEXT, UNIQUE(sender_id,client_message_id));
CREATE TABLE IF NOT EXISTS message_reads (message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(message_id,guest_id));
CREATE TABLE IF NOT EXISTS message_reactions (message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, emoji TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(message_id,guest_id,emoji));
CREATE INDEX IF NOT EXISTS idx_messages_channel_order ON messages(channel_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_message_reads_guest ON message_reads(guest_id,read_at);
INSERT OR IGNORE INTO channels(id,slug,name,kind,event_tag,side,posting_role) VALUES
('channel-announcements','announcements','Announcements','announcements',NULL,NULL,'admin'),
('channel-everyone','everyone','Everyone','everyone',NULL,NULL,'guest'),
('channel-sagai','sagai','Sagai','event','Sagai',NULL,'guest'),
('channel-haldi','haldi','Haldi','event','Haldi',NULL,'guest'),
('channel-mehndi','mehndi','Mehndi','event','Mehndi',NULL,'guest'),
('channel-wedding','wedding','Wedding','event','Wedding',NULL,'guest'),
('channel-bride','bride-side','Bride''s side','side',NULL,'bride','guest'),
('channel-groom','groom-side','Groom''s side','side',NULL,'groom','guest');
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(4,'live_chat');
UPDATE feature_flags SET enabled=1,updated_at=CURRENT_TIMESTAMP WHERE key='chat.realtime';
COMMIT;
