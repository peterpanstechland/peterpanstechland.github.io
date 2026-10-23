CREATE TABLE sponsor_applications (
 id TEXT PRIMARY KEY,
 tier TEXT NOT NULL CHECK(tier IN ('core','hardware','community')),
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 3),
 term TEXT NOT NULL CHECK(term IN ('month','year','project','event')),
 brand TEXT NOT NULL, website TEXT NOT NULL, tagline TEXT NOT NULL DEFAULT '',
 contact TEXT NOT NULL, association TEXT NOT NULL DEFAULT '', contribution TEXT NOT NULL DEFAULT '',
 requested_start TEXT NOT NULL, requested_end TEXT NOT NULL DEFAULT '',
 start_at INTEGER, end_at INTEGER,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paused')),
 payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','manual_confirmed','in_kind_confirmed')),
 amount_cents INTEGER NOT NULL, logo_key TEXT NOT NULL, receipt_hash TEXT NOT NULL,
 review_note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX sponsor_schedule ON sponsor_applications(status,start_at,end_at);
CREATE TABLE sponsor_audit (id INTEGER PRIMARY KEY,application_id TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created_at INTEGER NOT NULL);
-- Reserve one place per tier per rotation page. The trigger serializes competing reviews.
CREATE TRIGGER sponsor_no_overlap BEFORE UPDATE ON sponsor_applications
WHEN NEW.status='approved' AND EXISTS (
 SELECT 1 FROM sponsor_applications s WHERE s.id!=NEW.id AND s.status='approved'
 AND s.tier=NEW.tier AND s.page=NEW.page AND s.start_at<NEW.end_at AND s.end_at>NEW.start_at
)
BEGIN SELECT RAISE(ABORT,'sponsor_slot_conflict'); END;
