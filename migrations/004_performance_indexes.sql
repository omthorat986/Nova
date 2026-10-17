-- Migration 004: Performance & Safety Constraints
-- WAL mode, Foreign keys, Unique constraints and indexes on high-throughput lookup columns

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category);
CREATE INDEX IF NOT EXISTS idx_uploads_user_status ON uploads (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_follows_pair ON follows (follower_id, followee_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_pair ON post_likes (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at);
