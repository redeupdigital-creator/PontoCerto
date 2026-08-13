const express = require('express');
const { autenticar, permitir } = require('../middleware/auth');
const { montarPainelAoVivo } = require('../services/dashboardAoVivo');
const { verificarEnotificarAtrasos } = require('../services/monitorAtrasos');

const router = express.Router();

router.get('/hoje', autenticar, permitir('coordenador', 'consulta', 'admin'), async (req, res) => {
  try {
    const painel = await montarPainelAoVivo(req.usuario.empresaId);
    res.json(painel);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard] falha ao montar painel:', err);
    res.status(500).json({ erro: 'Falha ao montar o painel ao vivo' });
  }
});

// Rota do monitor de atrasos — NÃO usa o JWT normal (é chamada por um
// agendador, não por uma pessoa logada). Protegida por um segredo
// compartilhado (CRON_SECRET), enviado como Bearer token ou querystring
// `?secret=`. Pensada para ser disparada:
//  - por um Cron Job da Vercel (ver "crons" no vercel.json), a cada 15 min;
//  - ou por qualquer outro agendador externo (cron-job.org, etc.), se não
//    estiver na Vercel ou estiver no plano Hobby (sem Cron Jobs nativos);
//  - o servidor tradicional (src/server.js) também chama isso sozinho via
//    setInterval, então essa rota é essencial só para ambientes serverless.
router.all('/monitorar-atrasos', async (req, res) => {
  const segredoEsperado = process.env.CRON_SECRET;
  const segredoRecebido = (req.headers.authorization || '').replace('Bearer ', '') || req.query.secret;
  if (!segredoEsperado) {
    return res.status(503).json({ erro: 'CRON_SECRET não configurado no servidor — monitor de atrasos desativado.' });
  }
  if (segredoRecebido !== segredoEsperado) {
    return res.status(401).json({ erro: 'Segredo inválido' });
  }
  try {
    const resultado = await verificarEnotificarAtrasos();
    res.json(resultado);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[monitor-atrasos] falha:', err);
    res.status(500).json({ erro: 'Falha ao verificar atrasos' });
  }
});

module.exports = router;
