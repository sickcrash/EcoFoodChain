# syntax=docker/dockerfile:1

FROM node:20-slim AS base

WORKDIR /app

ENV NODE_ENV=production \
    npm_config_fund=false \
    npm_config_audit=false

# Install production dependencies
COPY package.json package-lock.json ./ 
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Ensure runtime directories exist
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "src/server.js"]
