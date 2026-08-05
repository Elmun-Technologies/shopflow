# syntax=docker/dockerfile:1

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20.19-alpine AS build
WORKDIR /app

# Install deps with layer caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build
COPY . .

# Telegram Mini App SDK'ni o'z domenimizdan berish uchun build vaqtida yuklab
# olamiz. Mijoz brauzeri (Telegram WebView) endi telegram.org ga bog'liq emas —
# ba'zi mobil operatorlar uni bloklaydi/sekinlashtiradi va o'shanda Mini App
# umuman ochilmasdi. Yuklab bo'lmasa repodagi stub qoladi (u CDN'ga qaytadi),
# ya'ni build hech qachon shu sabab yiqilmaydi.
RUN set -eu; \
    tmp="$(mktemp)"; \
    if wget -q -T 20 -O "$tmp" https://telegram.org/js/telegram-web-app.js \
       && [ -s "$tmp" ] \
       && grep -q 'TelegramWebviewProxy\|window.Telegram' "$tmp"; then \
      mkdir -p public/vendor; \
      install -m 0644 "$tmp" public/vendor/telegram-web-app.js; \
      echo "telegram-web-app.js vendored ($(wc -c < "$tmp") bytes)"; \
    else \
      echo "WARN: telegram-web-app.js yuklab bo'lmadi — CDN stub ishlatiladi"; \
    fi; \
    rm -f "$tmp"

ENV VITE_BASE_PATH=/
# Google OAuth client id — Vite build vaqtida embed qilinadi (bo'sh bo'lsa tugma yashirin)
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# nginx worker'lari `nginx` foydalanuvchisi ostida ishlaydi, root emas. Build
# bosqichida yaratilgan fayl tor huquq bilan qolsa (masalan `mktemp` → 0600),
# nginx uni o'qiy olmaydi va mijozga 403 qaytaradi — fayl mavjud bo'lsa ham.
# Aynan shu `/vendor/telegram-web-app.js` da yuz berdi. Butun dist'ni
# o'qiladigan qilamiz (kataloglarga faqat kerakli x biti — `a+rX`).
RUN chmod -R a+rX dist

# Build natijasini tekshiramiz: fayl bor, index.html unga havola qiladi VA u
# boshqalar uchun o'qiladigan. Aks holda deploy shu yerda qizil bo'lsin —
# jimgina 403/404 bo'lib mijozda chiqmasin.
RUN test -f dist/vendor/telegram-web-app.js \
    && test -f dist/index.html \
    && grep -q '/vendor/telegram-web-app.js' dist/index.html \
    && case "$(stat -c '%a' dist/vendor/telegram-web-app.js)" in \
         *[4567]) : ;; \
         *) echo "XATO: fayl 'other' uchun o'qilmaydi — nginx 403 qaytaradi"; exit 1 ;; \
       esac \
    && echo "dist/vendor/telegram-web-app.js OK ($(wc -c < dist/vendor/telegram-web-app.js) bytes, mode $(stat -c '%a' dist/vendor/telegram-web-app.js))"

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
