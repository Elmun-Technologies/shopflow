# ShopFlow backend — multi-stage build
FROM node:20-alpine AS build
WORKDIR /app
# OpenSSL Prisma uchun zarur (Alpine'da default yo'q)
RUN apk add --no-cache openssl libssl3
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl tini openssl libssl3 su-exec
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /app/node_modules/@prisma ./node_modules/@prisma
# Self-baselining migration runner (db push o'rniga prisma migrate)
COPY --chown=node:node scripts/db-migrate.mjs ./scripts/db-migrate.mjs
COPY scripts/docker-entrypoint.sh /usr/local/bin/shopflow-backend-entrypoint
RUN chmod 0755 /usr/local/bin/shopflow-backend-entrypoint

# Entrypoint volume kataloglarini root sifatida tayyorlaydi, keyin API'ni
# root huquqisiz `node` user ostida ishga tushiradi.
RUN mkdir -p /app/uploads /app/1c-exchange && chown node:node /app/uploads /app/1c-exchange

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:4000/health || exit 1

ENTRYPOINT ["/usr/local/bin/shopflow-backend-entrypoint"]
CMD ["sh", "-c", "node scripts/db-migrate.mjs && node dist/server.js"]
