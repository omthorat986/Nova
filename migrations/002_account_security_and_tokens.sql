-- Migration 002: Account Security, Verification & Session Revocation
-- Adds email_verified, session_version, reset_token_hash, reset_token_expires_at

-- Safely add columns if not present
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN session_version INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN reset_token_hash TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN reset_token_expires_at TIMESTAMP DEFAULT NULL;
