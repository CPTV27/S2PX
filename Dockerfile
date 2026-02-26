# ── S2PX API Docker Image ──
# Multi-stage build: install deps → runtime

FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server + shared source
COPY server/ ./server/
COPY shared/ ./shared/
COPY tsconfig.json tsconfig.server.json ./
COPY drizzle.config.ts ./

# ── Runtime ──
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig.server.json ./
COPY --from=builder /app/drizzle.config.ts ./

ENV NODE_ENV=production
EXPOSE 8080

# tsx runs TypeScript directly — avoids path alias build issues
CMD ["npx", "tsx", "server/index.ts"]
