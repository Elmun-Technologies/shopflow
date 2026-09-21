# ShopFlow frontend image for Fly.io.
# Build context: repository root (`fly deploy --config fly/frontend.toml`).

# syntax=docker/dockerfile:1
FROM node:20.19-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Telegram Mini App SDK'ni image ichiga vendoring qilamiz.
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
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_SENTRY_DSN=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build
RUN chmod -R a+rX dist

RUN test -f dist/vendor/telegram-web-app.js \
    && test -f dist/index.html \
    && grep -q '/vendor/telegram-web-app.js' dist/index.html \
    && case "$(stat -c '%a' dist/vendor/telegram-web-app.js)" in \
         *[4567]) : ;; \
         *) echo "XATO: Telegram SDK fayli nginx uchun o'qilmaydi"; exit 1 ;; \
       esac

FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache curl

ARG BACKEND_APP="shopflow-backend"
COPY fly/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i "s/shopflow-backend\\.internal/${BACKEND_APP}.internal/g" /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
