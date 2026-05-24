#!/bin/bash
# PostgreSQL backup script
# Cron uchun: 0 2 * * * /app/scripts/backup.sh >> /var/log/shopflow-backup.log 2>&1
# Har kech soat 2:00 da ishga tushadi, 7 kunlik backuplar saqlanadi

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DB_URL="${DATABASE_URL:-}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="shopflow_backup_${DATE}.sql.gz"

if [ -z "$DB_URL" ]; then
  echo "[$(date)] ERROR: DATABASE_URL o'rnatilmagan" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Backup boshlandi: $FILENAME"

# pg_dump + gzip
pg_dump "$DB_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date)] Backup yaratildi: $FILENAME ($SIZE)"

# Eski backuplarni o'chirish
find "$BACKUP_DIR" -name "shopflow_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] ${RETENTION_DAYS} kundan eski backuplar o'chirildi"

# Mavjud backuplar ro'yxati
TOTAL=$(find "$BACKUP_DIR" -name "shopflow_backup_*.sql.gz" | wc -l)
echo "[$(date)] Jami saqlangan backuplar: $TOTAL"
