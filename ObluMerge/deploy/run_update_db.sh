#!/usr/bin/env bash
# =============================================================================
# ObluMerge AWS PostgreSQL Database Update Runner
# Executed on EC2: /home/ubuntu/Oblu-CRM-App/ObluMerge/
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=================================================================="
echo " ObluMerge AWS PostgreSQL Database Update"
echo " Working directory: $PROJECT_DIR"
echo " Timestamp:         $(date)"
echo "=================================================================="

# 1. Check for dbb.sqlite3 or dbb.sqlite3.gz
if [ -f "dbb.sqlite3.gz" ]; then
    echo "==> Decompressing dbb.sqlite3.gz..."
    gunzip -f dbb.sqlite3.gz
fi

if [ ! -f "dbb.sqlite3" ]; then
    echo "[ERROR] dbb.sqlite3 not found in $PROJECT_DIR!"
    echo "Please copy dbb.sqlite3 or dbb.sqlite3.gz into $PROJECT_DIR first."
    exit 1
fi

echo "==> Found source dbb.sqlite3 ($(ls -lh dbb.sqlite3 | awk '{print $5}'))"

# 2. Check virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
else
    echo "[ERROR] Python virtualenv not found in $PROJECT_DIR/venv"
    exit 1
fi

# 3. Read DATABASE_URL from .env
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep -E '^DATABASE_URL=' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "[ERROR] DATABASE_URL is not set in .env!"
    exit 1
fi

# 4. Take automated safety backup of existing PostgreSQL database before touching anything!
BACKUP_FILE="/home/ubuntu/obludb_backup_$(date +%Y%m%d_%H%M%S).sql"
echo "==> [SAFETY STEP] Creating full PostgreSQL backup to:"
echo "    $BACKUP_FILE"

if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null || {
        echo "[WARNING] pg_dump with connection string had non-zero status. Trying with local postgres user..."
        sudo -u postgres pg_dump obludb > "$BACKUP_FILE" || true
    }
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        echo "    Backup created successfully ($(ls -lh "$BACKUP_FILE" | awk '{print $5}'))"
    else
        echo "    Could not dump to file directly; proceeding with cautious sync."
    fi
else
    echo "    pg_dump binary not found, proceeding with caution."
fi

# 5. Execute python sync
echo "==> Executing SQLite -> PostgreSQL full overwrite sync..."
python deploy/update_aws_postgres.py --sqlite dbb.sqlite3

# 6. Django system check
echo "==> Running Django system check against PostgreSQL..."
python manage.py check --database default

# 7. Restart services so cache and active queries reload
echo "==> Restarting Gunicorn application service..."
if sudo systemctl is-active --quiet gunicorn; then
    sudo systemctl restart gunicorn
    echo "    Gunicorn restarted."
elif sudo systemctl is-active --quiet oblumerge; then
    sudo systemctl restart oblumerge
    echo "    Oblumerge service restarted."
fi

echo "=================================================================="
echo " [COMPLETE] AWS PostgreSQL Database has been updated from dbb.sqlite3!"
echo "=================================================================="
