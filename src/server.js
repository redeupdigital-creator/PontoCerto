// Ponto de entrada para hospedagem TRADICIONAL (Docker, VPS, Render, Railway).
// Na Vercel, quem serve a API é api/index.js, que importa app.js diretamente
// e nunca chama listen()/sync() — a plataforma trata isso como função
// serverless, não como processo de longa duração.
require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;

async function start() {
  // Em desenvolvimento sem migrations rodadas, sync() cria as tabelas automaticamente.
  // Em produção, rode `npm run migrate` antes de iniciar e defina SKIP_SYNC=true.
  if (process.env.SKIP_SYNC !== 'true') {
    await sequelize.sync();
  }
  app.listen(PORT, () => {
    console.log(`API do sistema de ponto rodando em http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
