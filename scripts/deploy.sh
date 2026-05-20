#!/usr/bin/env bash
# ShopFlow manual VPS deploy — sinxron SSH, har bir qadam ko'rinadi
#
# Foydalanish:
#   scripts/deploy.sh <vps-host> [branch]
#
# Misol:
#   scripts/deploy.sh root@83.229.86.232 claude/fix-server-deployment-mwO5f
#   scripts/deploy.sh root@83.229.86.232          # joriy branch'ni deploy qiladi
#
# SSH parol so'rasa bir marta kiriting — keyin natija real vaqtda chiqadi.

set -euo pipefail

HOST="${1:-}"
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

if [ -z "$HOST" ]; then
  echo "❌ Foydalanish: $0 <user@host> [branch]" >&2
  echo "   Misol:    $0 root@83.229.86.232 main" >&2
  exit 1
fi

echo "🚀 Deploy boshlanmoqda"
echo "   Host:   $HOST"
echo "   Branch: $BRANCH"
echo ""

# Avval lokal commit'lar push qilinganmi tekshirish (faqat ogohlantirish)
if git rev-parse --git-dir >/dev/null 2>&1; then
  if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "⚠️  Diqqat: commit qilinmagan o'zgarishlar bor — server faqat push qilingan kodni oladi"
    echo ""
  fi
fi

# Sinxron SSH — output real vaqtda ko'rinadi, exit code ham qaytadi
ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=10 "$HOST" bash -s <<EOF
set -euo pipefail
cd /opt/shopflow

echo "==> [1/5] Origin'dan kod olish"
git fetch --all --prune

echo "==> [2/5] '$BRANCH' branch'ga o'tish"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "    HEAD: \$(git rev-parse --short HEAD) — \$(git log -1 --pretty=%s)"

echo "==> [3/5] Docker compose build & up"
docker compose up -d --build --remove-orphans

echo "==> [4/5] Eski image'larni tozalash"
docker image prune -f

echo "==> [5/5] Healthcheck"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://localhost/health >/dev/null; then
    echo "    ✅ Health OK (\$i-urinish)"
    break
  fi
  if [ "\$i" = "10" ]; then
    echo "    ❌ Healthcheck 10 urinishdan keyin muvaffaqiyatsiz"
    docker compose ps
    docker compose logs --tail=80
    exit 1
  fi
  sleep 3
done

echo ""
echo "===== Holatlar ====="
docker compose ps
EOF

echo ""
echo "✅ Deploy yakunlandi: $BRANCH → $HOST"
