# STAGE 1: Build Frontend
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build-renderer

# STAGE 2: Production Server
# Playwright requiere Chromium para SIRE y Buzón SUNAT
FROM mcr.microsoft.com/playwright:v1.58.2-jammy
WORKDIR /app

# Instalar dependencias para better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# Copiar el backend, módulos SIRE/Buzón, y el frontend construido
COPY server ./server
COPY main ./main
COPY modulo ./modulo
COPY --from=build-stage /app/dist ./dist

# Configurar variables de entorno
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

# Crear carpetas para datos persistentes
RUN mkdir -p /app/database /app/SIRE\ SUNAT /app/descargas_buzon

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server/app.js"]
