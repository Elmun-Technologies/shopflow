#!/usr/bin/env bash
# ShopFlow VPS bootstrap — bir martalik server sozlash
# Foydalanish: curl -fsSL https://raw.githubusercontent.com/Elmun-Technologies/shopflow/main/scripts/bootstrap.sh | bash -s -- <branch> <domain> <email>
# Yoki interactiv: bash bootstrap.sh

set -euo pipefail

BRANCH="${1:-${BRANCH:-main}}"
DOMAIN="${2:-${DOMAIN:-}}"
EMAIL="${3:-${EMAIL:-}}"

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
mkdir -p /opt
cd /opt
if [ -d shopflow/.git ]; then
  echo "   Repo allaqachon mavjud, yangilanmoqda..."
  cd shopflow
  git fetch --all
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" https://github.com/Elmun-Technologies/shopflow.git
  cd shopflow
fi

echo ""
echo "===== 6. .env yaratish ====="
# Mavjud .env saqlanadi (parollar yo'qolmasin uchun)
if [ -f .env ]; then
  echo "   .env allaqachon mavjud, qayta yaratilmaydi."
else
  POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  JWT_SECRET=$(openssl rand -hex 32)
  SEED_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)
  cat > .env <<EOF
DOMAIN=$DOMAIN
EMAIL=$EMAIL

POSTGRES_DB=shopflow
POSTGRES_USER=shopflow
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=https://$DOMAIN

SEED_TENANT_SLUG=demo
SEED_TENANT_NAME=ShopFlow Demo
SEED_EMAIL=admin@$DOMAIN
SEED_PASSWORD=$SEED_PASSWORD
SEED_USER_NAME=Admin
EOF
  chmod 600 .env
  echo "   .env yaratildi (parollar avtomatik generatsiya qilindi)"
  echo "   Birinchi admin: admin@$DOMAIN  /  parol: $SEED_PASSWORD"
fi

echo ""
echo "===== 7. Docker Compose ishga tushirish ====="
docker compose up -d --build

echo ""
echo "===== 8. Birinchi tenant'ni seed qilish ====="
sleep 5
docker compose exec -T backend npm run seed || echo "   (seed allaqachon o'tgan bo'lishi mumkin)"

echo ""
echo "===== 9. Holatni tekshirish ====="
docker compose ps
echo ""
echo "Health check:"
if curl -fsS http://localhost/health; then
  echo ""
  echo ""
  echo "✅ Muvaffaqiyatli! ShopFlow ishga tushdi."
  if [ "$DOMAIN" != ":80" ] && [ -n "$DOMAIN" ]; then
    echo "   Tashrif buyuring: https://$DOMAIN"
  else
    PUBLIC_IP=$(curl -s ifconfig.me || echo "<server-ip>")
    echo "   Tashrif buyuring: http://$PUBLIC_IP"
  fi
  echo ""
  echo "   Admin kirish ma'lumotlari .env faylida (SEED_EMAIL va SEED_PASSWORD)."
else
  echo "❌ Health check muvaffaqiyatsiz. 'docker compose logs' bilan tekshiring."
fi
