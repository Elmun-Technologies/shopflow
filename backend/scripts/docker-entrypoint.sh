#!/bin/sh
# Fly Volume/Docker volume'lar ko'pincha root egasida mount qilinadi.
# Backend esa node user sifatida ishlashi kerak, shuning uchun writable kataloglar
# startup'da tayyorlanib, keyin jarayon root'siz ishga tushiriladi.
set -eu

uploads_dir="${UPLOADS_DIR:-/app/uploads}"
exchange_dir="${ONEC_EXCHANGE_DIR:-/app/1c-exchange}"

mkdir -p "$uploads_dir" "$exchange_dir"
chown -R node:node "$uploads_dir" "$exchange_dir"

exec su-exec node /sbin/tini -- "$@"
