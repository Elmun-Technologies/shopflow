#!/bin/sh
# Fly Volume/Docker volume'lar ko'pincha root egasida mount qilinadi.
# Backend esa node user sifatida ishlashi kerak, shuning uchun writable kataloglar
# startup'da tayyorlanib, keyin jarayon root'siz ishga tushiriladi.
set -eu

uploads_dir="${UPLOADS_DIR:-/app/uploads}"
exchange_dir="${ONEC_EXCHANGE_DIR:-/app/1c-exchange}"

mkdir -p "$uploads_dir" "$exchange_dir"

# Docker Compose production image drops all capabilities and Docker usually
# populates named volumes with the image directory ownership already set to
# node. Fly Volume esa ko'pincha root egasida mount qilinadi. Faqat Fly config
# dagi explicit flag bilan recursive chown qilamiz — aks holda cap_drop=ALL
# bo'lgan Compose container'i startup'da yiqilib qolishi mumkin.
if [ "${FIX_VOLUME_PERMISSIONS:-false}" = "true" ]; then
  chown -R node:node "$uploads_dir" "$exchange_dir"
fi

exec su-exec node /sbin/tini -- "$@"
