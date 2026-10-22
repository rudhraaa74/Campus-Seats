# ─────────────────────────────────────────────────────────────
# frontend/Dockerfile
# Multi-stage Docker build: Vite production build + Nginx static server
# ─────────────────────────────────────────────────────────────

# Stage 1: Build static assets with Node.js
FROM node:18-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm install

# Copy frontend source and build bundle
COPY . .
RUN npm run build

# Stage 2: Serve static bundle via Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build output from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration (handles SPA routing and /api proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
