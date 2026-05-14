# syntax=docker/dockerfile:1.7
# Vite SPA static build + nginx for serving.
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/bot/package.json apps/bot/
COPY apps/admin/package.json apps/admin/
COPY apps/miniapp/package.json apps/miniapp/
COPY apps/storefront/package.json apps/storefront/
COPY packages/db/package.json packages/db/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/observability/package.json packages/observability/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /repo
COPY packages packages
COPY apps/admin apps/admin

# `VITE_API_URL` is baked into the bundle at build time, so it must be passed
# as a build arg by Dokploy (Service settings → Build → Args).
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @shopflow/admin build

FROM nginx:1.27-alpine AS runner
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
