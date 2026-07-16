#!/bin/sh
# Nightly Postgres backup — run from the HOST via crontab, not inside a container.
# Crontab example (crontab -e):
#   0 4 * * * /opt/ekonobar/app/deploy/backup.sh >> /var/log/ekonobar-backup.log 2>&1
set -eu

APP_DIR="/opt/ekonobar/app"        # where the repo is cloned
BACKUP_DIR="/opt/ekonobar/backups"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec -T db pg_dump -U postgres ekonobar \
  | gzip > "$BACKUP_DIR/ekonobar-$(date +%F).sql.gz"

find "$BACKUP_DIR" -name 'ekonobar-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "[backup] done: ekonobar-$(date +%F).sql.gz"
