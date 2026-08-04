#!/bin/bash
# PostgreSQL backup — local + ixtiyoriy offsite (S3 / Cloudflare R2 / Backblaze B2 / MinIO).
# Cron uchun: 0 2 * * * /app/scripts/backup.sh >> /var/log/shopflow-backup.log 2>&1
# Har kuni ishga tushadi, RETENTION_DAYS kun local saqlanadi.
#
# Offsite (ixtiyoriy, lekin production uchun TAVSIYA — VPS yo'qolsa ham backup tashqarida):
#   BACKUP_S3_BUCKET o'rnatilsa, aws-cli orqali yuklanadi.
#   R2/B2/MinIO uchun BACKUP_S3_ENDPOINT bering (AWS S3 uchun shart emas).
#   Kalitlar: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION (standart AWS env).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DB_URL="${DATABASE_URL:-}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="shopflow_backup_${DATE}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

if [ -z "$DB_URL" ]; then
  echo "[$(date)] ERROR: DATABASE_URL o'rnatilmagan" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "[$(date)] Backup boshlandi: $FILENAME"

# pg_dump + gzip — muvaffaqiyatsiz bo'lsa qisman faylni tozalaymiz
if ! pg_dump "$DB_URL" | gzip > "$FILEPATH"; then
  echo "[$(date)] ERROR: pg_dump muvaffaqiyatsiz" >&2
  rm -f "$FILEPATH"
  exit 1
fi

# Buzilgan/qisman arxivni backup deb qabul qilmaymiz.
gzip -t "$FILEPATH"
chmod 600 "$FILEPATH"
sha256sum "$FILEPATH" > "${FILEPATH}.sha256"
chmod 600 "${FILEPATH}.sha256"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "[$(date)] Backup yaratildi: $FILENAME ($SIZE)"

# === Offsite (ixtiyoriy) — eng muhim DR himoyasi ===
# best-effort: yuklash muvaffaqiyatsiz bo'lsa ham local backup saqlanadi.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    ep=""
    [ -n "${BACKUP_S3_ENDPOINT:-}" ] && ep="--endpoint-url ${BACKUP_S3_ENDPOINT}"
    # shellcheck disable=SC2086
    if aws s3 cp "$FILEPATH" "s3://${BACKUP_S3_BUCKET}/${FILENAME}" $ep; then
      # shellcheck disable=SC2086
      aws s3 cp "${FILEPATH}.sha256" "s3://${BACKUP_S3_BUCKET}/${FILENAME}.sha256" $ep || \
        echo "[$(date)] WARNING: offsite checksum yuklanmadi" >&2
      echo "[$(date)] Offsite yuklandi: s3://${BACKUP_S3_BUCKET}/${FILENAME}"
    else
      echo "[$(date)] WARNING: offsite yuklash muvaffaqiyatsiz (local backup saqlandi)" >&2
    fi
  else
    echo "[$(date)] WARNING: aws-cli topilmadi — offsite o'tkazib yuborildi" >&2
  fi
fi

# Eski local backuplarni o'chirish (offsite retention — bucket lifecycle rule bilan).
find "$BACKUP_DIR" -name "shopflow_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -name "shopflow_backup_*.sql.gz.sha256" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] ${RETENTION_DAYS} kundan eski local backuplar o'chirildi"

TOTAL=$(find "$BACKUP_DIR" -name "shopflow_backup_*.sql.gz" | wc -l)
echo "[$(date)] Jami local backuplar: $TOTAL"
