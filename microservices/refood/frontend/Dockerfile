# syntax=docker/dockerfile:1

FROM node:20-slim AS build

WORKDIR /app

ENV EXPO_NO_TELEMETRY=1 \
    CI=1 \
    npm_config_fund=false \
    npm_config_audit=false

ARG EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .

RUN npx expo export --platform web --output-dir dist --clear

FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
