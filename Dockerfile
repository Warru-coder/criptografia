# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install production deps only (re-runs native addons with --ignore-scripts off)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and static assets
COPY --from=builder /app/dist ./dist
COPY public/ ./public/

# Non-root user for security
RUN addgroup -S securecrypt && adduser -S securecrypt -G securecrypt
RUN chown -R securecrypt:securecrypt /app

USER securecrypt

EXPOSE 3000

CMD ["node", "dist/web/server.js"]
