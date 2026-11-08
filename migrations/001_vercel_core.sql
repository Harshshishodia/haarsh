CREATE TABLE IF NOT EXISTS app_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY,
  phone_hash text UNIQUE NOT NULL,
  display_name text NOT NULL,
  side text NOT NULL CHECK (side IN ('bride', 'groom', 'shared')),
  relation text NOT NULL,
  role text NOT NULL DEFAULT 'guest',
  preferred_language text NOT NULL DEFAULT 'Hinglish',
  review_state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_challenges (
  id uuid PRIMARY KEY,
  phone_hash text NOT NULL,
  code_hash text NOT NULL,
  start_token_hash text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'otp_sent', 'exchanged', 'expired', 'locked')),
  telegram_chat_id text,
  telegram_user_id text,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consented_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_challenges_phone_idx
  ON login_challenges(phone_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash text PRIMARY KEY,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id uuid DEFAULT gen_random_uuid();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_label text NOT NULL DEFAULT 'Web browser';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  window_start timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rsvps (
  guest_id uuid PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE,
  responses jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manager_records (
  id uuid PRIMARY KEY,
  section text NOT NULL,
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'New',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES guests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manager_records_section_idx ON manager_records(section, created_at DESC);
CREATE TABLE IF NOT EXISTS baraat_sessions (id uuid PRIMARY KEY,label text NOT NULL,state text NOT NULL DEFAULT 'draft',tracker_id uuid REFERENCES guests(id),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS baraat_points (session_id uuid REFERENCES baraat_sessions(id) ON DELETE CASCADE,sequence integer NOT NULL,latitude double precision NOT NULL,longitude double precision NOT NULL,accuracy_m double precision NOT NULL,signal_state text NOT NULL,recorded_at timestamptz NOT NULL,PRIMARY KEY(session_id,sequence));
ALTER TABLE baraat_points ADD COLUMN IF NOT EXISTS speed_mps double precision;
ALTER TABLE baraat_points ADD COLUMN IF NOT EXISTS heading double precision;
ALTER TABLE baraat_points ADD COLUMN IF NOT EXISTS battery_percent double precision;
CREATE TABLE IF NOT EXISTS baraat_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  start_lat double precision,
  start_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  destination_label text NOT NULL DEFAULT 'Wedding venue',
  geofence_m integer NOT NULL DEFAULT 500,
  share_enabled boolean NOT NULL DEFAULT false,
  webhook_token_hash text,
  updated_by uuid REFERENCES guests(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO baraat_config(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS social_posts (id uuid PRIMARY KEY,author_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,caption text NOT NULL DEFAULT '',event_tag text,media_data text,status text NOT NULL DEFAULT 'published',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS social_post_likes (post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,guest_id));
CREATE TABLE IF NOT EXISTS social_post_saves (post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,guest_id));
CREATE TABLE IF NOT EXISTS social_comments (id uuid PRIMARY KEY,post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,author_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS social_stories (id uuid PRIMARY KEY,author_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,media_data text,text_content text,event_tag text,status text NOT NULL DEFAULT 'published',expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS social_story_views (story_id uuid REFERENCES social_stories(id) ON DELETE CASCADE,viewer_id uuid REFERENCES guests(id) ON DELETE CASCADE,viewed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(story_id,viewer_id));
CREATE INDEX IF NOT EXISTS social_posts_feed_idx ON social_posts(status,created_at DESC);
CREATE INDEX IF NOT EXISTS social_stories_feed_idx ON social_stories(status,expires_at,created_at DESC);
CREATE TABLE IF NOT EXISTS user_notifications (id uuid PRIMARY KEY,recipient_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,kind text NOT NULL,title text NOT NULL,body text NOT NULL DEFAULT '',target text,dedupe_key text UNIQUE,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS user_notifications_recipient_idx ON user_notifications(recipient_id,created_at DESC);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS avatar_data text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS invited_events jsonb NOT NULL DEFAULT '["event-sagai","event-wedding"]'::jsonb;
CREATE TABLE IF NOT EXISTS social_follows (follower_id uuid REFERENCES guests(id) ON DELETE CASCADE,followed_id uuid REFERENCES guests(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(follower_id,followed_id),CHECK(follower_id<>followed_id));
CREATE TABLE IF NOT EXISTS social_story_reactions (story_id uuid REFERENCES social_stories(id) ON DELETE CASCADE,guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,emoji text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(story_id,guest_id));

INSERT INTO app_migrations(version, name)
VALUES (1, 'vercel_core')
ON CONFLICT (version) DO NOTHING;
