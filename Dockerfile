  FROM node:20-bookworm-slim AS builder

  ENV CI=true
  WORKDIR /app
  
  RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
  
  # Efficient cache
  COPY package.json yarn.lock ./
  COPY nest-cli.json tsconfig*.json ./
  
  RUN yarn install --frozen-lockfile
  
  COPY src ./src
  COPY src/database/schema.prisma ./src/database/schema.prisma
  
  RUN yarn prisma generate --schema src/database/schema.prisma
  
  RUN yarn build
  
  # ---------- Runtime minimal ----------
  FROM node:20-bookworm-slim AS runner
  ENV NODE_ENV=production
  WORKDIR /app
  
  RUN groupadd -r nodejs && useradd -r -g nodejs nodejs
  
  COPY package.json yarn.lock ./
  
  RUN yarn install --frozen-lockfile --production
  
  COPY --from=builder /app/dist ./dist
  # COPY --from=builder /app/public ./public
  
  EXPOSE 8080
  
  USER nodejs
  
  # Start
  CMD ["node", "dist/main.js"]
  