# ========= deps =========
FROM node:20-bookworm-slim AS deps
ENV CI=true
WORKDIR /app
COPY package.json yarn.lock ./
COPY nest-cli.json tsconfig*.json ./
RUN yarn install --frozen-lockfile

# ========= builder =========
FROM node:20-bookworm-slim AS builder
ENV CI=true
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock nest-cli.json tsconfig*.json ./
COPY src ./src

RUN yarn prisma generate --schema ./src/database/schema/schema.prisma
RUN ls -lh node_modules/.prisma/client | sed -n '1,200p'

RUN yarn build

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

USER node
COPY --chown=node:node package.json yarn.lock ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/main.js"]
