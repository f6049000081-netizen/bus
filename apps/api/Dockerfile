# Build context is the monorepo root (see .dockerignore + DO app spec source_dir: /)
# so npm workspace hoisting resolves correctly (apps/api relies on root-level deps like dotenv).

FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /repo/apps/api
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/package.json ./package.json

EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
