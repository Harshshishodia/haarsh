import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const dbPath = resolve(process.env.DATA_DIR || './data', 'wedding.db')
mkdirSync(dirname(dbPath), { recursive: true })
export const db = new DatabaseSync(dbPath)

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY, phone_hash TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, side TEXT NOT NULL CHECK(side IN ('bride','groom','shared')), relation TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'guest', household_name TEXT NOT NULL, preferred_language TEXT NOT NULL DEFAULT 'Hinglish', invited_events TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rsvps (guest_id TEXT PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE, answers TEXT NOT NULL, attendee_count INTEGER NOT NULL, diet TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS help_requests (id TEXT PRIMARY KEY, guest_id TEXT REFERENCES guests(id) ON DELETE SET NULL, category TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', owner TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS consents (id TEXT PRIMARY KEY, guest_id TEXT REFERENCES guests(id) ON DELETE CASCADE, purpose TEXT NOT NULL, granted INTEGER NOT NULL CHECK(granted IN (0,1)), policy_version TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(guest_id,purpose,policy_version));
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, label TEXT NOT NULL, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, phone_hash TEXT NOT NULL, code_hash TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('telegram','whatsapp','admin')), status TEXT NOT NULL DEFAULT 'pending', telegram_chat_id TEXT, exchange_token_hash TEXT, attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS feature_flags (key TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), description TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS data_imports (id TEXT PRIMARY KEY, source TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0, problem_count INTEGER NOT NULL DEFAULT 0, checksum TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS system_health (component TEXT PRIMARY KEY, state TEXT NOT NULL, facts TEXT NOT NULL DEFAULT '{}', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS inbound_events (id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_digest TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT, UNIQUE(provider, external_id));
CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, channel TEXT NOT NULL CHECK(channel IN ('telegram','ntfy','web','whatsapp')), recipient_ref TEXT NOT NULL, message_type TEXT NOT NULL, payload TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')), status TEXT NOT NULL DEFAULT 'pending', idempotency_key TEXT NOT NULL UNIQUE, attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS delivery_attempts (id TEXT PRIMARY KEY, outbox_id TEXT NOT NULL REFERENCES outbox(id) ON DELETE CASCADE, provider TEXT NOT NULL, attempt_number INTEGER NOT NULL, state TEXT NOT NULL, provider_message_id TEXT, error_code TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(outbox_id, attempt_number));
CREATE TABLE IF NOT EXISTS dead_letters (id TEXT PRIMARY KEY, outbox_id TEXT NOT NULL UNIQUE REFERENCES outbox(id) ON DELETE CASCADE, reason TEXT NOT NULL, payload_digest TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT, resolved_by TEXT);
CREATE TABLE IF NOT EXISTS msg_budget (provider TEXT NOT NULL, period TEXT NOT NULL, free_allowance INTEGER NOT NULL DEFAULT 0, delivered_count INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL CHECK(mode IN ('GREEN','AMBER','RED','BLACK')), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(provider,period));
CREATE TABLE IF NOT EXISTS provider_quota (provider TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('healthy','degraded','disabled')), consecutive_failures INTEGER NOT NULL DEFAULT 0, circuit_open_until TEXT, facts TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS system_controls (key TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), description TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS guest_profiles (guest_id TEXT PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE, bio TEXT NOT NULL DEFAULT '', avatar_url TEXT, posting_approved INTEGER NOT NULL DEFAULT 0 CHECK(posting_approved IN (0,1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, caption TEXT NOT NULL DEFAULT '', event_tag TEXT, status TEXT NOT NULL CHECK(status IN ('pending','published','hidden','archived','deleted')), pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)), alt_text TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS post_media (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, media_type TEXT NOT NULL CHECK(media_type IN ('image','video')), storage_key TEXT NOT NULL, width INTEGER, height INTEGER, duration_ms INTEGER, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(post_id,position));
CREATE TABLE IF NOT EXISTS post_likes (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(post_id,guest_id));
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS comment_likes (comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(comment_id,guest_id));
CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_id,name));
CREATE TABLE IF NOT EXISTS saves (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(post_id,guest_id));
CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, media_type TEXT NOT NULL CHECK(media_type IN ('image','video','text')), storage_key TEXT, text_content TEXT, event_tag TEXT, status TEXT NOT NULL CHECK(status IN ('pending','published','hidden','deleted')), expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS story_views (story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE, viewer_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, first_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(story_id,viewer_id));
CREATE TABLE IF NOT EXISTS story_reactions (story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, emoji TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(story_id,guest_id));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, actor_id TEXT REFERENCES guests(id) ON DELETE SET NULL, kind TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, entity_type TEXT NOT NULL CHECK(entity_type IN ('post','comment','story','profile')), entity_id TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','dismissed','actioned')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS moderation_queue (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, reason TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')), reviewer_id TEXT REFERENCES guests(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT, UNIQUE(entity_type,entity_id,state));
CREATE TABLE IF NOT EXISTS blocks (blocker_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, blocked_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(blocker_id,blocked_id));
CREATE TABLE IF NOT EXISTS mutes (guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, muted_guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(guest_id,muted_guest_id));
CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('everyone','event','side','announcements')), event_tag TEXT, side TEXT, posting_role TEXT NOT NULL DEFAULT 'guest', frozen INTEGER NOT NULL DEFAULT 0 CHECK(frozen IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS channel_members (channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)), joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(channel_id,guest_id));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, client_message_id TEXT NOT NULL, message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','image','voice','system')), body TEXT NOT NULL DEFAULT '', media_key TEXT, reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','deleted')), pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, edited_at TEXT, deleted_at TEXT, UNIQUE(sender_id,client_message_id));
CREATE TABLE IF NOT EXISTS message_reads (message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(message_id,guest_id));
CREATE TABLE IF NOT EXISTS message_reactions (message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, emoji TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(message_id,guest_id,emoji));
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, event_date TEXT NOT NULL, start_time TEXT, venue TEXT, address TEXT, status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rsvp_responses (guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, response TEXT NOT NULL CHECK(response IN ('coming','maybe','not_coming')), adults INTEGER NOT NULL DEFAULT 0, kids INTEGER NOT NULL DEFAULT 0, attendee_names TEXT NOT NULL DEFAULT '[]', diet TEXT NOT NULL DEFAULT 'Vegetarian', stay_needed INTEGER NOT NULL DEFAULT 0 CHECK(stay_needed IN (0,1)), arrival_mode TEXT, arrival_time TEXT, pickup_point TEXT, notes TEXT NOT NULL DEFAULT '', late INTEGER NOT NULL DEFAULT 0 CHECK(late IN (0,1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(guest_id,event_id));
CREATE TABLE IF NOT EXISTS seating_plans (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), version INTEGER NOT NULL DEFAULT 1, created_by TEXT REFERENCES guests(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT);
CREATE TABLE IF NOT EXISTS seating_units (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES seating_plans(id) ON DELETE CASCADE, unit_type TEXT NOT NULL CHECK(unit_type IN ('table','seat','room','bus')), name TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity>0), attributes TEXT NOT NULL DEFAULT '{}', UNIQUE(plan_id,name));
CREATE TABLE IF NOT EXISTS seating_assignments (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES seating_plans(id) ON DELETE CASCADE, unit_id TEXT NOT NULL REFERENCES seating_units(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, seat_label TEXT, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(plan_id,guest_id));
CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, property_name TEXT NOT NULL, room_number TEXT NOT NULL, capacity INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '', UNIQUE(property_name,room_number));
CREATE TABLE IF NOT EXISTS room_assignments (room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, check_in TEXT, check_out TEXT, PRIMARY KEY(room_id,guest_id));
CREATE TABLE IF NOT EXISTS transport_requests (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, mode TEXT NOT NULL, arrival_at TEXT, pickup_point TEXT, passengers INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','assigned','arrived','cancelled')), driver_name TEXT, vehicle_label TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS arrivals (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE, event_id TEXT REFERENCES events(id) ON DELETE SET NULL, arrived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, source TEXT NOT NULL DEFAULT 'admin', UNIQUE(guest_id,event_id));
CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, spec_json TEXT NOT NULL, prompt_version TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), health TEXT NOT NULL DEFAULT 'unknown', loaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id), trigger_type TEXT NOT NULL, input_digest TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','succeeded','failed','blocked')), output_json TEXT, error_code TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
CREATE TABLE IF NOT EXISTS agent_actions (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE, agent_id TEXT NOT NULL REFERENCES agents(id), tool_id TEXT NOT NULL, autonomy_tier TEXT NOT NULL CHECK(autonomy_tier IN ('A0','A1','A2','A3')), state TEXT NOT NULL CHECK(state IN ('proposed','executed','blocked','undone','failed')), input_json TEXT NOT NULL, output_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS agent_feedback (id TEXT PRIMARY KEY, run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL, guest_id TEXT REFERENCES guests(id) ON DELETE SET NULL, rating INTEGER CHECK(rating IN (-1,1)), note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS autopilot_actions (id TEXT PRIMARY KEY, action_id TEXT NOT NULL UNIQUE REFERENCES agent_actions(id) ON DELETE CASCADE, mode TEXT NOT NULL CHECK(mode IN ('on','observe','off')), undo_until TEXT, notified_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS undo_log (id TEXT PRIMARY KEY, action_id TEXT NOT NULL UNIQUE REFERENCES agent_actions(id) ON DELETE CASCADE, inverse_tool_id TEXT NOT NULL, inverse_input_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'available' CHECK(state IN ('available','used','expired')), used_by TEXT REFERENCES guests(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, used_at TEXT);
CREATE TABLE IF NOT EXISTS standing_orders (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, rule_json TEXT NOT NULL, autonomy_tier TEXT NOT NULL CHECK(autonomy_tier IN ('A0','A1','A2','A3')), version INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), updated_by TEXT REFERENCES guests(id) ON DELETE SET NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')), state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','in_progress','done','blocked','cancelled')), owner_id TEXT REFERENCES guests(id) ON DELETE SET NULL, due_at TEXT, source TEXT NOT NULL DEFAULT 'operator', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS task_events (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, actor_id TEXT, event_type TEXT NOT NULL, facts_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS agent_blackboard (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, provenance TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 1 CHECK(confidence>=0 AND confidence<=1), expires_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS kb_documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, verified_at TEXT, status TEXT NOT NULL CHECK(status IN ('verified','draft','retired')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(title,version));
CREATE TABLE IF NOT EXISTS kb_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE, chunk_key TEXT NOT NULL UNIQUE, content TEXT NOT NULL, facts_json TEXT NOT NULL DEFAULT '{}', embedding_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS eval_cases (id TEXT PRIMARY KEY, suite_id TEXT NOT NULL, language TEXT NOT NULL, input_json TEXT NOT NULL, expected_json TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', synthetic INTEGER NOT NULL DEFAULT 1 CHECK(synthetic IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS eval_runs (id TEXT PRIMARY KEY, suite_id TEXT NOT NULL, prompt_version TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','passed','failed')), total INTEGER NOT NULL DEFAULT 0, passed INTEGER NOT NULL DEFAULT 0, metrics_json TEXT NOT NULL DEFAULT '{}', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
CREATE TABLE IF NOT EXISTS semantic_cache (cache_key TEXT PRIMARY KEY, intent TEXT NOT NULL, language TEXT NOT NULL, response_json TEXT NOT NULL, citations_json TEXT NOT NULL, expires_at TEXT, hit_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS provider_usage (id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, tier INTEGER NOT NULL, input_units INTEGER NOT NULL DEFAULT 0, output_units INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER, state TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS prompt_releases (id TEXT PRIMARY KEY, component TEXT NOT NULL, version TEXT NOT NULL, content_digest TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('shadow','active','retired')), eval_run_id TEXT REFERENCES eval_runs(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(component,version));
CREATE INDEX IF NOT EXISTS idx_sessions_guest_active ON sessions(guest_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_phone_status ON auth_challenges(phone_hash, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_help_requests_status_created ON help_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_dispatch ON outbox(status, priority, available_at);
CREATE INDEX IF NOT EXISTS idx_inbound_received ON inbound_events(provider, received_at);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(status,pinned DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(status,expires_at,created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_guest ON notifications(guest_id,read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_state ON moderation_queue(state,created_at);
CREATE INDEX IF NOT EXISTS idx_messages_channel_order ON messages(channel_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_message_reads_guest ON message_reads(guest_id,read_at);
CREATE INDEX IF NOT EXISTS idx_rsvp_event_response ON rsvp_responses(event_id,response);
CREATE INDEX IF NOT EXISTS idx_seating_guest_published ON seating_assignments(guest_id,published);
CREATE INDEX IF NOT EXISTS idx_transport_status ON transport_requests(status,arrival_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_state ON agent_runs(state,started_at);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created ON agent_actions(agent_id,state,created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(state,priority,due_at);
CREATE INDEX IF NOT EXISTS idx_kb_document_status ON kb_documents(status,verified_at);
CREATE INDEX IF NOT EXISTS idx_eval_cases_suite ON eval_cases(suite_id,language);
CREATE INDEX IF NOT EXISTS idx_provider_usage_recent ON provider_usage(provider,created_at);
`)

const foundationFlags: [string, number, string][] = [
  ['auth.telegram', 1, 'Telegram contact verification fallback'],
  ['auth.whatsapp', 0, 'WhatsApp reverse OTP after free/eligibility verification'],
  ['social.feed', 0, 'Private wedding feed'],
  ['social.stories', 0, 'Stories and viewer tracking'],
  ['chat.realtime', 0, 'Realtime wedding channels'],
  ['rsvp', 1, 'Household RSVP'],
  ['baraat.tracking', 0, 'Consent-controlled Baraat location'],
  ['autopilot', 0, 'Agent actions; observe-only requires separate state'],
]
const insertFlag = db.prepare('INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES (?, ?, ?)')
for (const flag of foundationFlags) insertFlag.run(...flag)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (1, 'foundation')").run()

const messagingControls: [string, number, string][] = [
  ['freeze.posting', 0, 'Block guest posting'],
  ['freeze.chat', 0, 'Block guest chat'],
  ['freeze.non_p0', 0, 'Allow only P0 outbound work'],
  ['panic', 0, 'Freeze every non-P0 action and outbound message'],
]
const insertControl = db.prepare('INSERT OR IGNORE INTO system_controls(key,enabled,description) VALUES(?,?,?)')
for (const control of messagingControls) insertControl.run(...control)
db.prepare("INSERT OR IGNORE INTO provider_quota(provider,state,facts) VALUES('telegram','disabled','{}'),('ntfy','disabled','{}'),('whatsapp','disabled','{\"reason\":\"cost_or_eligibility_unverified\"}'),('web','healthy','{}')").run()
const period = new Date().toISOString().slice(0,7)
db.prepare("INSERT OR IGNORE INTO msg_budget(provider,period,free_allowance,delivered_count,mode) VALUES('whatsapp',?,0,0,'BLACK'),('telegram',?,0,0,'GREEN'),('ntfy',?,0,0,'GREEN')").run(period,period,period)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (2, 'messaging_spine')").run()
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (3, 'private_social_layer')").run()
db.prepare("UPDATE feature_flags SET enabled=1,updated_at=CURRENT_TIMESTAMP WHERE key IN ('social.feed','social.stories')").run()
const seedChannel=db.prepare('INSERT OR IGNORE INTO channels(id,slug,name,kind,event_tag,side,posting_role) VALUES(?,?,?,?,?,?,?)')
for(const channel of [
  ['channel-announcements','announcements','Announcements','announcements',null,null,'admin'],
  ['channel-everyone','everyone','Everyone','everyone',null,null,'guest'],
  ['channel-sagai','sagai','Sagai','event','Sagai',null,'guest'],
  ['channel-haldi','haldi','Haldi','event','Haldi',null,'guest'],
  ['channel-mehndi','mehndi','Mehndi','event','Mehndi',null,'guest'],
  ['channel-wedding','wedding','Wedding','event','Wedding',null,'guest'],
  ['channel-bride','bride-side',"Bride's side",'side',null,'bride','guest'],
  ['channel-groom','groom-side',"Groom's side",'side',null,'groom','guest'],
] as [string,string,string,string,string|null,string|null,string][])seedChannel.run(...channel)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (4, 'live_chat')").run()
db.prepare("UPDATE feature_flags SET enabled=1,updated_at=CURRENT_TIMESTAMP WHERE key='chat.realtime'").run()
const seedEvent=db.prepare('INSERT OR IGNORE INTO events(id,slug,name,event_date,start_time,venue,address,status) VALUES(?,?,?,?,?,?,?,?)')
for(const event of [
 ['event-sagai','sagai','Sagai','2027-02-12',null,null,null,'to_be_confirmed'],
 ['event-haldi','haldi','Haldi','2027-02-14',null,null,null,'to_be_confirmed'],
 ['event-mehndi','mehndi','Mehndi','2027-02-15',null,null,null,'to_be_confirmed'],
 ['event-wedding','wedding','Wedding','2027-02-16',null,'Emerald Green','Govindpuram, Ghaziabad','confirmed'],
] as [string,string,string,string,string|null,string|null,string|null,string][])seedEvent.run(...event)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (5, 'rsvp_seating_transport')").run()
db.prepare("INSERT OR IGNORE INTO settings(key,value_json) VALUES('autopilot.mode','\"off\"'),('autopilot.hourly_cap','20'),('operator.last_run','null'),('nigrani.last_run','null')").run()
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (6, 'agent_platform')").run()
db.prepare("UPDATE feature_flags SET enabled=1,updated_at=CURRENT_TIMESTAMP WHERE key='autopilot'").run()
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (7, 'ai_quality_engine')").run()

db.exec(`
CREATE TABLE IF NOT EXISTS watchtower_runs (id TEXT PRIMARY KEY, trigger_type TEXT NOT NULL CHECK(trigger_type IN ('scheduled','manual','drill')), state TEXT NOT NULL CHECK(state IN ('running','healthy','degraded','failed')), checks_total INTEGER NOT NULL DEFAULT 0, checks_failed INTEGER NOT NULL DEFAULT 0, summary TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
CREATE TABLE IF NOT EXISTS watchtower_checks (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES watchtower_runs(id) ON DELETE CASCADE, check_key TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pass','warn','fail','skipped')), priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')), facts_json TEXT NOT NULL DEFAULT '{}', duration_ms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')), source TEXT NOT NULL, title TEXT NOT NULL, facts_json TEXT NOT NULL DEFAULT '{}', suggested_action TEXT NOT NULL, dedupe_key TEXT NOT NULL, owner TEXT, state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','acknowledged','resolved','snoozed')), occurrence_count INTEGER NOT NULL DEFAULT 1, opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, acknowledged_at TEXT, resolved_at TEXT, snoozed_until TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_active_dedupe ON alerts(dedupe_key) WHERE state IN ('open','acknowledged','snoozed');
CREATE INDEX IF NOT EXISTS idx_alert_state_priority ON alerts(state,priority,updated_at DESC);
CREATE TABLE IF NOT EXISTS alert_deliveries (id TEXT PRIMARY KEY, alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE, ladder_step INTEGER NOT NULL, channel TEXT NOT NULL, recipient_ref TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','sent','skipped','failed')), reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(alert_id,ladder_step,channel,recipient_ref));
CREATE TABLE IF NOT EXISTS synthetic_guest_runs (id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('running','passed','failed')), probes_total INTEGER NOT NULL DEFAULT 0, probes_passed INTEGER NOT NULL DEFAULT 0, results_json TEXT NOT NULL DEFAULT '[]', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
CREATE TABLE IF NOT EXISTS metric_samples (id TEXT PRIMARY KEY, metric_key TEXT NOT NULL, value REAL NOT NULL, sampled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_metric_key_time ON metric_samples(metric_key,sampled_at DESC);
CREATE TABLE IF NOT EXISTS maintenance_windows (id TEXT PRIMARY KEY, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)
db.prepare("INSERT OR IGNORE INTO settings(key,value_json) VALUES('watchtower.enabled','true'),('watchtower.interval_seconds','120'),('alerts.admin_recipient','\"admin\"'),('alerts.backup_recipient','\"Sanjeev\"')").run()
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (8, 'watchtower_alerts')").run()

db.exec(`
CREATE TABLE IF NOT EXISTS security_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('info','warn','critical')), source_hash TEXT, facts_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(event_type,created_at DESC);
CREATE TABLE IF NOT EXISTS drill_runs (id TEXT PRIMARY KEY, drill_type TEXT NOT NULL CHECK(drill_type IN ('freeze','panic','l2','restore','webhook_replay')), state TEXT NOT NULL CHECK(state IN ('running','passed','failed')), expected_json TEXT NOT NULL, observed_json TEXT NOT NULL DEFAULT '{}', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
CREATE TABLE IF NOT EXISTS retention_jobs (id TEXT PRIMARY KEY, job_type TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('planned','running','complete','failed')), records_affected INTEGER NOT NULL DEFAULT 0, cutoff_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
`)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (9, 'security_hardening')").run()

db.exec(`
CREATE TABLE IF NOT EXISTS tracker_sessions (id TEXT PRIMARY KEY, tracker_id TEXT NOT NULL REFERENCES guests(id), label TEXT NOT NULL, tracker_type TEXT NOT NULL CHECK(tracker_type IN ('baraat','shuttle','vendor')), state TEXT NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','live','stopped','expired')), consented_at TEXT, starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, stopped_at TEXT, destination_lat REAL, destination_lng REAL, created_by TEXT REFERENCES guests(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tracker_points (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tracker_sessions(id) ON DELETE CASCADE, sequence INTEGER NOT NULL, latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180), accuracy_m REAL NOT NULL CHECK(accuracy_m>=0), speed_mps REAL, heading REAL, battery_percent INTEGER CHECK(battery_percent BETWEEN 0 AND 100), signal_state TEXT CHECK(signal_state IN ('good','weak','offline')), recorded_at TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id,sequence));
CREATE INDEX IF NOT EXISTS idx_tracker_points_latest ON tracker_points(session_id,sequence DESC);
CREATE TABLE IF NOT EXISTS tracker_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tracker_sessions(id) ON DELETE CASCADE, event_type TEXT NOT NULL, facts_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (10, 'live_baraat_tracking')").run()
db.prepare("UPDATE feature_flags SET enabled=1,updated_at=CURRENT_TIMESTAMP WHERE key='baraat.tracking'").run()

db.exec(`
CREATE TABLE IF NOT EXISTS gallery_albums (id TEXT PRIMARY KEY, title TEXT NOT NULL, event_tag TEXT, description TEXT NOT NULL DEFAULT '', visibility TEXT NOT NULL DEFAULT 'wedding' CHECK(visibility IN ('wedding','admin')), download_enabled INTEGER NOT NULL DEFAULT 0 CHECK(download_enabled IN (0,1)), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), created_by TEXT REFERENCES guests(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT);
CREATE TABLE IF NOT EXISTS gallery_items (album_id TEXT NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE, media_id TEXT NOT NULL REFERENCES post_media(id) ON DELETE CASCADE, position INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)), added_by TEXT REFERENCES guests(id), added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(album_id,media_id));
CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(album_id,featured DESC,position,added_at);
CREATE TABLE IF NOT EXISTS gallery_consents (guest_id TEXT PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE, local_face_match INTEGER NOT NULL DEFAULT 0 CHECK(local_face_match IN (0,1)), consented_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)
db.prepare("INSERT OR IGNORE INTO feature_flags(key,enabled,description) VALUES('gallery.shared',1,'Private event albums'),('gallery.face_match',0,'Opt-in local-only photos of me'),('social.reels',0,'Stretch vertical video'),('ceremony.live',0,'Stretch live stream')").run()
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (11, 'private_gallery')").run()

db.exec(`
CREATE TABLE IF NOT EXISTS operation_modes (id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('normal','rehearsal','war_room','teardown')), state TEXT NOT NULL CHECK(state IN ('active','closed')), activated_by TEXT REFERENCES guests(id), reason TEXT NOT NULL, activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_operation_mode ON operation_modes(state) WHERE state='active';
CREATE TABLE IF NOT EXISTS runbook_steps (id TEXT PRIMARY KEY, phase TEXT NOT NULL, offset_day INTEGER NOT NULL, title TEXT NOT NULL, owner_role TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')), acceptance TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','in_progress','passed','blocked','skipped')), evidence_json TEXT NOT NULL DEFAULT '{}', completed_by TEXT REFERENCES guests(id), completed_at TEXT, UNIQUE(phase,title));
CREATE INDEX IF NOT EXISTS idx_runbook_queue ON runbook_steps(state,offset_day,priority);
CREATE TABLE IF NOT EXISTS shift_handoffs (id TEXT PRIMARY KEY, from_operator TEXT REFERENCES guests(id), to_operator TEXT REFERENCES guests(id), summary TEXT NOT NULL, open_p0 INTEGER NOT NULL DEFAULT 0, open_p1 INTEGER NOT NULL DEFAULT 0, acknowledged_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)
db.prepare("INSERT OR IGNORE INTO operation_modes(id,mode,state,reason) VALUES('mode-normal','normal','active','Default operating mode')").run()
const runbookSeed:[string,number,string,string,string,string][]=[
 ['prelaunch',-30,'Verify guest import and consent records','admin','P1','Dry run reports no unexplained duplicates'],
 ['prelaunch',-21,'Complete Telegram and alert delivery rehearsal','admin','P1','Test message is received and acknowledged'],
 ['prelaunch',-14,'Freeze schema and risky feature changes','admin','P1','Only emergency fixes allowed'],
 ['prelaunch',-7,'Run restore, panic, L2 and P0 drills','admin','P0','Every drill passes with recorded evidence'],
 ['prelaunch',-3,'Start 24-hour Synthetic Guest soak','watchtower','P0','No failed probe for 24 hours'],
 ['prelaunch',-1,'Confirm operator and backup shift handoff','admin','P0','Primary and backup acknowledge'],
 ['wedding',0,'Open war room and verify all dashboards','admin','P0','Health, alerts, queues and tracking green'],
 ['wedding',0,'Verify Baraat tracker consent and backup link','admin','P0','Tracker and fallback rehearsed'],
 ['post',1,'Export gallery and operational logs','admin','P2','Checksums recorded'],
 ['post',7,'Review retention and teardown decision','admin','P1','Archive or deletion plan approved']
]
const insertRunbook=db.prepare('INSERT OR IGNORE INTO runbook_steps(id,phase,offset_day,title,owner_role,priority,acceptance) VALUES(?,?,?,?,?,?,?)')
for(const row of runbookSeed)insertRunbook.run(crypto.randomUUID(),...row)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (12, 'rehearsal_war_room')").run()

db.exec(`
CREATE TABLE IF NOT EXISTS teardown_plans (id TEXT PRIMARY KEY, disposition TEXT NOT NULL CHECK(disposition IN ('archive','delete')), state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','approved','executed','cancelled')), execute_after TEXT NOT NULL, scope_json TEXT NOT NULL, dry_run_json TEXT NOT NULL DEFAULT '{}', created_by TEXT REFERENCES guests(id), approved_by TEXT REFERENCES guests(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, approved_at TEXT, executed_at TEXT);
CREATE TABLE IF NOT EXISTS teardown_checklist (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES teardown_plans(id) ON DELETE CASCADE, category TEXT NOT NULL, action TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete','not_applicable')), evidence TEXT, completed_by TEXT REFERENCES guests(id), completed_at TEXT, UNIQUE(plan_id,category,action));
CREATE TABLE IF NOT EXISTS data_exports (id TEXT PRIMARY KEY, export_type TEXT NOT NULL, checksum TEXT NOT NULL, facts_json TEXT NOT NULL, created_by TEXT REFERENCES guests(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)
db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (13, 'teardown_archive')").run()

export function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: object = {}) {
  db.prepare('INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), actorId, action, entityType, entityId, JSON.stringify(metadata))
}
