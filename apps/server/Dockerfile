# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Generate Prisma client
RUN cd apps/server && pnpm prisma generate

# Build shared package and server
RUN pnpm build --filter=@jocasta/server

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy workspace files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy shared package
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy server
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Copy node_modules with Prisma client
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Switch to non-root user
USER nestjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "cd apps/server && npx prisma migrate deploy && node dist/main.js"]
