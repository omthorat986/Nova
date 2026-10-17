-- Migration 003: Structured Audit Log Table
-- Logs sensitive actions (who, what, when, IP) for login, failed login, password change, role change, delete, suspend, approve

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT NULL,
    username TEXT DEFAULT NULL,
    action TEXT NOT NULL,
    details TEXT DEFAULT NULL,
    ip_address TEXT NOT NULL,
    request_id TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
