# CanXJS Production Dockerfile
# Optimized for Bun

FROM oven/bun:1.0 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy source
COPY src ./src
COPY public ./public
COPY tsconfig.json ./

# Build info
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command
# Adjust entrypoint if needed (e.g., src/index.ts)
CMD ["bun", "run", "src/main.ts"]
