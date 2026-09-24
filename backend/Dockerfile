FROM node:20-slim

# Install build tools required for compiling native addons (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Ensure storage directory for persistent SQLite database and uploads exists
RUN mkdir -p /var/data/uploads/od-documents

# Default production environment settings
ENV NODE_ENV=production
ENV PORT=5001
ENV DATABASE_PATH=/var/data/database.sqlite
ENV UPLOAD_DIR=/var/data/uploads/od-documents

# Expose service port
EXPOSE 5001

# Volume for data persistence (Render, Railway, Docker volume)
VOLUME ["/var/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5001}/health || exit 1

# Start the application server
CMD ["node", "server.js"]
