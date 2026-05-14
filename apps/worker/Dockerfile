# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && apk add --no-cache openssl

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
COPY apps/worker apps/worker
RUN pnpm --filter @shopflow/db generate
RUN pnpm --filter @shopflow/worker --filter @shopflow/shared-types --filter @shopflow/observability --filter @shopflow/db build
RUN pnpm --filter @shopflow/worker deploy --prod /out

FROM base AS runner
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/worker/dist ./dist
COPY --from=build /repo/apps/worker/package.json ./package.json
COPY --from=build /repo/packages/db ./node_modules/@shopflow/db

# Workers don't accept HTTP traffic — Dokploy healthcheck via process liveness.
CMD ["node", "dist/main.js"]
