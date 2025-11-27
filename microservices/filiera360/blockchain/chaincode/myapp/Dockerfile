FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Prima copia solo i file delle dipendenze
COPY package*.json ./

# Poi installa le dipendenze
RUN npm ci

# Infine copia tutto il resto del codice
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
