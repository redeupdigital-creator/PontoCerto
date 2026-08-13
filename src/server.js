// Ponto de entrada para hospedagem TRADICIONAL (Docker, VPS, Render, Railway).
// Na Vercel, quem serve a API é api/index.js, que importa app.js diretamente
// e nunca chama listen()/sync() — a plataforma trata isso como função
// serverless, não como processo de longa duração.
require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const { verificarEnotificarAtrasos } = require('./services/monitorAtrasos');

const PORT = process.env.PORT || 3000;
const INTERVALO_MONITOR_MS = 15 * 60 * 1000; // 15 minutos

async function start() {
  // Em desenvolvimento sem migrations rodadas, sync() cria as tabelas automaticamente.
  // Em produção, rode `npm run migrate` antes de iniciar e defina SKIP_SYNC=true.
  if (process.env.SKIP_SYNC !== 'true') {
    await sequelize.sync();
  }
  app.listen(PORT, () => {
    console.log(`API do sistema de ponto rodando em http://localhost:${PORT}`);
  });

  // Monitor de atrasos: só roda aqui (hospedagem tradicional de processo
  // longo). Em serverless (Vercel), quem cuida disso é o Cron Job batendo em
  // /api/dashboard/monitorar-atrasos — ver vercel.json e DEPLOY_SUPABASE_VERCEL.md.
  setInterval(() => {
    verificarEnotificarAtrasos().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[monitor-atrasos] falha na verificação periódica:', err.message);
    });
  }, INTERVALO_MONITOR_MS);
}

start();

module.exports = app;
