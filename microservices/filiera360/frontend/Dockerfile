# --- STAGE 1: Build ---
FROM node:18-alpine as builder

WORKDIR /app

# Copia e installa dipendenze
COPY package*.json ./
RUN npm ci

# Copia il codice
COPY . .

# Compila l'applicazione per la produzione
# Questo userà la "homepage": "/filiera360" definita nel package.json
RUN npm run build


# --- STAGE 2 ---
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

# ECCO LA MODIFICA: Copia il file che ora è locale
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80