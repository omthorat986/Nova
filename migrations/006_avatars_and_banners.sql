-- Migration 006: User & Agency Avatars, Logos, and Banners
-- Adds avatar_key, avatar_updated_at, banner_key, avatar_color to users
-- Adds logo_key, banner_key, logo_updated_at, banner_updated_at to agencies

ALTER TABLE users ADD COLUMN avatar_key TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN banner_key TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT NULL;

ALTER TABLE agencies ADD COLUMN logo_key TEXT DEFAULT NULL;
ALTER TABLE agencies ADD COLUMN banner_key TEXT DEFAULT NULL;
ALTER TABLE agencies ADD COLUMN logo_updated_at TIMESTAMP DEFAULT NULL;
ALTER TABLE agencies ADD COLUMN banner_updated_at TIMESTAMP DEFAULT NULL;

-- Backfill avatar_key from avatar_s3_key if legacy exists
UPDATE users SET avatar_key = avatar_s3_key WHERE avatar_s3_key IS NOT NULL AND avatar_key IS NULL;
UPDATE users SET avatar_updated_at = created_at WHERE avatar_key IS NOT NULL AND avatar_updated_at IS NULL;
