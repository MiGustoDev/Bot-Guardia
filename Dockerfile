FROM node:20-bookworm-slim

# Instalar Chromium y certificados para Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=5000

WORKDIR /app

# Copiar definiciones de paquetes
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Instalar dependencias del backend sin devDeps
RUN cd server && npm install --omit=dev

# Instalar dependencias del frontend con devDependencies (para tener vite)
RUN cd client && NODE_ENV=development npm install --include=dev

# Copiar el código fuente completo
COPY server/ ./server/
COPY client/ ./client/

# Compilar frontend React (Vite)
RUN cd client && npm run build

# Ahora sí seteamos producción para la ejecución
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server/index.js"]
