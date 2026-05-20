#!/usr/bin/env bash
# ShopFlow VPS bootstrap — bir martalik server sozlash
#
# Repo PRIVATE, shuning uchun ikki bosqichli ishga tushirish kerak:
#
#   1) GitHub Personal Access Token (PAT) yarating — Settings → Developer
#      settings → Personal access tokens → Fine-grained → faqat shu repo
#      uchun "Contents: Read" ruxsati bilan.
#
#   2) Serverda:
#        export GH_TOKEN=ghp_xxxxxxxxxxxxxxxx
#        git clone https://${GH_TOKEN}@github.com/Elmun-Technologies/shopflow.git /opt/shopflow
#        cd /opt/shopflow
#        bash scripts/bootstrap.sh [branch] [domain] [email]
#
# Parametrlar berilmasa interaktiv so'raydi. GH_TOKEN env var bo'lsa,
# klonlash/yangilash uchun ishlatiladi (private repo uchun zarur).

set -euo pipefail

BRANCH="${1:-${BRANCH:-main}}"
DOMAIN="${2:-${DOMAIN:-}}"
EMAIL="${3:-${EMAIL:-}}"
GH_TOKEN="${GH_TOKEN:-}"

REPO_URL="https://github.com/Elmun-Technologies/shopflow.git"
if [ -n "$GH_TOKEN" ]; then
  REPO_URL="https://${GH_TOKEN}@github.com/Elmun-Technologies/shopflow.git"
fi

# stdin pipe orqali kelganda (curl | bash) interactive prompt ishlamaydi
if [ ! -t 0 ] && { [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; }; then
  echo "❌ Pipe orqali ishga tushirilganda DOMAIN va EMAIL parametr bo'lib berilishi kerak." >&2
  echo "   Misol: curl -fsSL .../bootstrap.sh | bash -s -- main shopflow.example.com you@mail.com" >&2
  echo "   Yoki domain o'rniga ':80' (faqat HTTP, IP bo'yicha):" >&2
  echo "   curl -fsSL .../bootstrap.sh | bash -s -- main :80 admin@example.com" >&2
  exit 1
fi

echo "🚀 ShopFlow VPS bootstrap"
echo "   Branch: $BRANCH"

# Interactive prompt agar parametr berilmagan bo'lsa
if [ -z "$DOMAIN" ]; then
  read -rp "Domain (masalan: shopflow.example.com, yoki IP uchun ':80'): " DOMAIN
fi
if [ -z "$EMAIL" ]; then
  read -rp "Let's Encrypt email: " EMAIL
fi

echo ""
echo "===== 1. Tizimni yangilash ====="
apt update -qq
apt upgrade -y -qq

echo ""
echo "===== 2. Asosiy paketlar ====="
apt install -y -qq curl git ufw ca-certificates

echo ""
echo "===== 3. Docker o'rnatish ====="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "   Docker allaqachon o'rnatilgan: $(docker --version)"
fi

echo ""
echo "===== 4. Firewall sozlash ====="
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
echo "y" | ufw enable >/dev/null 2>&1 || true
ufw status

echo ""
echo "===== 5. ShopFlow'ni klonlash ====="
# Agar skript klonlangan repo ichidan ishga tushirilgan bo'lsa, qaytadan klonlamaymiz.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -d "$REPO_ROOT/.git" ] && [ -f "$REPO_ROOT/docker-compose.yml" ]; then
  echo "   Skript repo ichidan ishga tushirildi: $REPO_ROOT"
  cd "$REPO_ROOT"
  git fetch --all --prune
  git checkout -B "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  mkdir -p /opt
  cd /opt
  if [ -d shopflow/.git ]; then
    echo "   Repo allaqachon mavjud, yangilanmoqda..."
    cd shopflow
    git fetch --all --prune
    git checkout -B "$BRANCH" "origin/$BRANCH"
    git reset --hard "origin/$BRANCH"
  else
    if [ -z "$GH_TOKEN" ]; then
      echo "❌ Repo PRIVATE — klonlash uchun GH_TOKEN env var kerak."
      echo "   Foydalanish:"
      echo "     export GH_TOKEN=ghp_xxxxxxxxxxxxxxxx"
      echo "     bash scripts/bootstrap.sh [branch] [domain] [email]"
      exit 1
    fi
    git clone -b "$BRANCH" "$REPO_URL" shopflow
    cd shopflow
  fi
fi

echo ""
echo "===== 6. .env yaratish ====="
cat > .env <<EOF
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF
echo "   .env yaratildi:"
cat .env

echo ""
echo "===== 7. Docker Compose ishga tushirish ====="
docker compose up -d --build

echo ""
echo "===== 8. Holatni tekshirish ====="
docker compose ps
echo ""
echo "Health check (10 urinish, har 3 sekundda):"
HEALTH_OK=false
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://localhost/health >/dev/null 2>&1; then
    echo "   ✅ Health OK ($i-urinish)"
    HEALTH_OK=true
    break
  fi
  sleep 3
done

echo ""
if [ "$HEALTH_OK" = true ]; then
  echo "✅ Muvaffaqiyatli! ShopFlow ishga tushdi."
  if [ "$DOMAIN" != ":80" ] && [ -n "$DOMAIN" ]; then
    echo "   Tashrif buyuring: https://$DOMAIN"
  else
    PUBLIC_IP=$(curl -s ifconfig.me || echo "<server-ip>")
    echo "   Tashrif buyuring: http://$PUBLIC_IP"
  fi
else
  echo "❌ Health check muvaffaqiyatsiz. Tekshirish:"
  echo "   docker compose logs --tail=80"
  exit 1
fi
