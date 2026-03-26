# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx (proxy-capable) ─────────────────────────────────
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template — the official nginx image auto-runs envsubst
# on files in /etc/nginx/templates/ at startup, outputting to /etc/nginx/conf.d/
# This allows $BACKEND_HOST to be injected at container start time.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 7845

# CMD inherited from nginx:alpine: ["nginx", "-g", "daemon off;"]
