# ==========================================
# Dockerfile für Clash Royale Discord Bot
# Basiert auf modernem Node.js 22 LTS (mit nativem SQLite)
# ==========================================

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Berlin

# Zeitzonendatenbank für Alpine installieren
RUN apk add --no-cache tzdata

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

# Verzeichnis für SQLite Datenbank erstellen und Berechtigungen setzen
RUN mkdir -p /app/data && chown -R node:node /app

USER node

# Startbefehl
CMD ["node", "src/index.js"]
