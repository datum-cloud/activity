# Build stage
FROM node:20-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /app

# Copy workspace and lock files first for better caching
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy library config files
COPY tsconfig.json ./
COPY rollup.config.mjs ./

# Copy source files for the library
COPY src/ ./src/

# Copy example app files
COPY example/package.json ./example/
COPY example/app/ ./example/app/
COPY example/tsconfig.json ./example/
COPY example/vite.config.ts ./example/
COPY example/tailwind.config.js ./example/
COPY example/postcss.config.js ./example/

# Install dependencies and build
RUN pnpm install --frozen-lockfile && \
    pnpm --filter @miloapis/activity-ui build && \
    pnpm --filter activity-ui-example build

# Runtime stage - Node.js for Remix server
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built server and client assets
COPY --from=builder /app/example/build ./build
COPY --from=builder /app/example/package.json ./
# pnpm hoists dependencies to root node_modules
COPY --from=builder /app/node_modules ./node_modules

# Expose port 3000
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Start the Remix server
CMD ["npx", "remix-serve", "./build/server/index.js"]
