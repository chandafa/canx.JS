# Base image
FROM oven/bun:1-alpine as base
WORKDIR /app

# Development stage
FROM base as dev
COPY package.json bun.lockb ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "dev"]

# Build stage
FROM base as builder
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM base as prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# Install production deps only (if any specific runtimes needed, otherwise bun includes primitive ones)
# RUN bun install --production 
EXPOSE 3000
CMD ["bun", "dist/index.js"]
