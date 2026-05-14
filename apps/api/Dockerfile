# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for the ShopFlow API.
# Build context MUST be the monorepo root.
#   docker build -f apps/api/Dockerfile -t shopflow-api .

# ────────────────────────── 1) base ──────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && apk add --no-cache openssl

# ────────────────────────── 2) deps ──────────────────────────
# Cache-friendly install: copy manifests + lockfile only.
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

# ────────────────────────── 3) build ──────────────────────────
FROM deps AS build
WORKDIR /repo
COPY packages packages
COPY apps/api apps/api

# Generate Prisma client first — apps/api imports it.
RUN pnpm --filter @shopflow/db generate

# Compile only the API and its workspace dependencies.
RUN pnpm --filter @shopflow/api --filter @shopflow/shared-types --filter @shopflow/observability --filter @shopflow/db build

# Trim node_modules to production deps (dev deps not needed at runtime).
RUN pnpm --filter @shopflow/api deploy --prod /out

# ────────────────────────── 4) runner ──────────────────────────
FROM base AS runner
WORKDIR /app

# Copy the production-only deploy bundle.
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/packages/db/prisma ./prisma
COPY --from=build /repo/packages/db ./node_modules/@shopflow/db

COPY apps/api/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
