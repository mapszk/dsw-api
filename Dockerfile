# Imagen para desarrollo local (hot reload con tsx watch)
FROM node:22-alpine

WORKDIR /app

# Correr como usuario "node" (uid 1000) para que los archivos generados
# dentro del bind mount no queden con dueño root en la maquina host
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run dev"]
