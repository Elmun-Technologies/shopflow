# syntax=docker/dockerfile:1

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20.19-alpine AS build
WORKDIR /app

# Install deps with layer caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build
COPY . .
ENV VITE_BASE_PATH=/
# Google OAuth client id — Vite build vaqtida embed qilinadi (bo'sh bo'lsa tugma yashirin)
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

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
