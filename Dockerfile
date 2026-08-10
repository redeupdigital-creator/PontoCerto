FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Diretórios que precisam existir em runtime (uploads de foto, sqlite local)
RUN mkdir -p uploads data

EXPOSE 3000

# Roda as migrations e sobe a API. Em produção com Postgres, isso garante
# que o schema esteja sempre atualizado antes do servidor aceitar requisições.
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node src/server.js"]
