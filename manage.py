#!/usr/bin/env python3
"""
NOVA Observatory — CLI Administrative Management Script
Usage:
    python manage.py migrate           # Run idempotent schema migrations
    python manage.py seed              # Seed agency channels & General Space
    python manage.py create-curator    # Interactively create first curator account
    python manage.py test              # Run automated regression test suite
    python manage.py runserver         # Start local dev server (port 8080)
"""
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import (
    run_database_migrations,
    seed_agencies,
    create_curator_cli,
    run_automated_tests,
    main as server_main
)

def print_help():
    print("""
🌌 NOVA Observatory Management CLI

Commands:
  migrate          Apply all pending database migrations
  seed             Seed official space agencies and General Space channel
  create-curator   Create or elevate the initial curator/admin account
  test             Execute the automated regression test suite
  runserver        Launch development server (default port 8080)
""")

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help', 'help'):
        print_help()
        sys.exit(0)

    cmd = sys.argv[1].lower()

    if cmd == 'migrate':
        print("🔄 Running database migrations...")
        run_database_migrations()
        print("✅ Migrations applied successfully.")

    elif cmd == 'seed':
        print("🌱 Seeding agency channels...")
        seed_agencies()
        print("✅ Agencies seeded successfully.")

    elif cmd in ('create-curator', 'create_curator', 'createsuperuser'):
        create_curator_cli()

    elif cmd == 'test':
        port = 8080
        if len(sys.argv) > 2 and sys.argv[2].isdigit():
            port = int(sys.argv[2])
        sys.exit(run_automated_tests(port))

    elif cmd in ('runserver', 'start'):
        # Pass remaining arguments to server_main
        sys.argv = [sys.argv[0]] + sys.argv[2:]
        server_main()

    else:
        print(f"❌ Unknown command '{cmd}'")
        print_help()
        sys.exit(1)

if __name__ == '__main__':
    main()
