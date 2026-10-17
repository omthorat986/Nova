# ==============================================================================
# NOVA Observatory — Production Gunicorn WSGI Configuration
# Optimized for AWS EC2 (t3.micro: 2 vCPUs, 1 GB RAM)
# ==============================================================================

import multiprocessing
import os

# Server Socket
bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:8080")
backlog = 2048

# Worker Processes
# SQLite Concurrency Caveat:
# SQLite handles concurrent reads gracefully via WAL mode (Write-Ahead Logging),
# but serializes write transactions. To prevent database lock contention on SQLite,
# worker count is deliberately capped at 2 for a t3.micro instance.
# UPGRADE PATH: If scaling across multiple instances or high write volume,
# migrate SQLite to Amazon RDS PostgreSQL / Aurora and increase worker count.
workers = int(os.environ.get("GUNICORN_WORKERS", 2))
worker_class = "sync"
worker_connections = 1000
timeout = 60
graceful_timeout = 30
keepalive = 5

# Worker Recycling (Prevent Memory Leaks on low-RAM instances like t3.micro)
max_requests = 1000
max_requests_jitter = 50

# Process Naming
proc_name = "nova_wsgi"

# Logging & Telemetry
# Logs are rotated and collected by AWS CloudWatch Agent
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

accesslog = os.path.join(LOGS_DIR, "access.log")
errorlog = os.path.join(LOGS_DIR, "app.log")
loglevel = os.environ.get("LOG_LEVEL", "info").lower()
access_log_format = '%({x-request-id}i)s %(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Security: Drop Privileges if started as root (container fallback)
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

def on_starting(server):
    """Lifecycle hook: logs gunicorn startup parameters."""
    server.log.info("NOVA WSGI application server starting on %s with %s workers", bind, workers)
