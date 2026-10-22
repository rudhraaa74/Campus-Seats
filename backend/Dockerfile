# ─────────────────────────────────────────────────────────────
# backend/Dockerfile
# Multi-stage / lightweight Node.js Alpine container for SeatSync API
# ─────────────────────────────────────────────────────────────

FROM node:18-alpine

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY . .

# Expose backend REST API port
EXPOSE 3001

# Start the Node.js HTTP server
CMD ["node", "src/index.js"]
