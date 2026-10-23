CREATE TABLE IF NOT EXISTS entries (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('photo','message','wish')),
 name TEXT NOT NULL DEFAULT '',
 text TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','removed')),
 wish_state TEXT NOT NULL DEFAULT 'open' CHECK(wish_state IN ('open','making','fulfilled')),
 photo_key TEXT,
 delete_hash TEXT NOT NULL,
 reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS entries_wall ON entries(status,created_at DESC);
CREATE TABLE IF NOT EXISTS rate_events (id TEXT PRIMARY KEY, actor TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_actor ON rate_events(actor,created_at);
