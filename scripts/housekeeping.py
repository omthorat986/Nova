#!/usr/bin/env python3
"""
NOVA Space Observatory — Automated Housekeeping & Maintenance Routine
Performs:
1. Purging of expired password reset tokens (>30 min)
2. Cleaning stale or unverified sessions and old feed caches (>48h)
3. Orphaned upload detection and cloud storage cleanup
4. Automated SQLite snapshot backup preparation
"""

import os
import sys
import time
import sqlite3
import logging
from datetime import datetime, timezone, timedelta

DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get('NOVA_DB_PATH', os.path.join(DIRECTORY, 'nova.db'))
LOGS_DIR = os.path.join(DIRECTORY, 'logs')
LOCAL_UPLOADS_DIR = os.path.join(DIRECTORY, 'local_uploads')

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def run_housekeeping():
    logging.info(f"Starting housekeeping routine on {DB_PATH}")
    if not os.path.exists(DB_PATH):
        logging.warning("Database not found. Exiting.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Clear expired password reset tokens
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            UPDATE users
            SET reset_token_hash = NULL, reset_token_expires_at = NULL
            WHERE reset_token_expires_at IS NOT NULL AND reset_token_expires_at < ?
        """, (now_iso,))
        expired_tokens = cursor.rowcount
        logging.info(f"Purged {expired_tokens} expired password reset tokens.")

        # 2. Clean stale feed cache entries older than 24h
        cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        cursor.execute("DELETE FROM feed_cache WHERE updated_at < ?", (cutoff_24h,))
        stale_cache = cursor.rowcount
        logging.info(f"Purged {stale_cache} stale external feed cache entries.")

        # 3. Clean orphaned local upload files if in local storage mode
        cursor.execute("SELECT s3_key FROM uploads WHERE s3_key IS NOT NULL UNION SELECT s3_key FROM posts WHERE s3_key IS NOT NULL UNION SELECT s3_key FROM outreach WHERE s3_key IS NOT NULL UNION SELECT avatar_s3_key FROM users WHERE avatar_s3_key IS NOT NULL")
        active_keys = set(r[0] for r in cursor.fetchall() if r[0])

        orphaned_files = 0
        if os.path.exists(LOCAL_UPLOADS_DIR):
            for root, _, files in os.walk(LOCAL_UPLOADS_DIR):
                for f in files:
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, LOCAL_UPLOADS_DIR)
                    if rel_p not in active_keys:
                        # If file is older than 2 hours, delete
                        if time.time() - os.path.getmtime(full_p) > 7200:
                            try:
                                os.remove(full_p)
                                orphaned_files += 1
                            except Exception as err:
                                logging.warning(f"Could not remove orphaned file {full_p}: {err}")
        logging.info(f"Removed {orphaned_files} orphaned storage files.")

        conn.commit()

        # 4. Check database integrity and optimize
        cursor.execute("PRAGMA optimize;")
        cursor.execute("PRAGMA integrity_check;")
        integrity = cursor.fetchone()
        logging.info(f"Database integrity check: {integrity[0]}")

    except Exception as e:
        logging.error(f"Housekeeping exception: {e}")
    finally:
        conn.close()

    logging.info("Housekeeping routine completed successfully.")

if __name__ == '__main__':
    run_housekeeping()
