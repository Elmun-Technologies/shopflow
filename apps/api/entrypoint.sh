#!/bin/sh
set -e

# Applies pending Prisma migrations on container start. Idempotent: if there
# are no new migrations, this is a no-op. Run only on the API container —
# worker/bot share the same database and rely on the API to migrate first.
if [ -z "${SKIP_MIGRATIONS}" ]; then
  echo "[entrypoint] Running database migrations…"
  npx --no-install prisma migrate deploy --schema /app/prisma/schema.prisma
fi

exec "$@"
