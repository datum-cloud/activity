# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for the library
COPY package*.json ./
COPY tsconfig.json ./
COPY rollup.config.mjs ./

# Copy source files for the library
COPY src/ ./src/

# Install dependencies and build the library
RUN npm ci && npm run build

# Copy example app package files
COPY example/package*.json ./example/

# Copy example app source and config
COPY example/app/ ./example/app/
COPY example/tsconfig.json ./example/
COPY example/vite.config.ts ./example/
COPY example/postcss.config.js ./example/
COPY example/tailwind.config.js ./example/

# Install example dependencies and build
WORKDIR /app/example
RUN npm ci && npm run build

# Runtime stage - Node.js for Remix server
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built server and client assets
COPY --from=builder /app/example/build ./build
COPY --from=builder /app/example/package*.json ./
COPY --from=builder /app/example/node_modules ./node_modules

# Expose port 3000
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Start the Remix server
CMD ["npm", "run", "start"]
