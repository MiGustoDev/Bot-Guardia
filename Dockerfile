FROM node:20-bookworm-slim

# Instalar Chromium y dependencias de sistema para Puppeteer en Debian Bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para Puppeteer y Node
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Copiar package configs
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Instalar dependencias
RUN npm install --prefix server --omit=dev
RUN npm install --prefix client

# Copiar el resto del código
COPY server/ ./server/
COPY client/ ./client/

# Build del frontend
RUN npm run build --prefix client

EXPOSE 5000

CMD ["node", "server/index.js"]
