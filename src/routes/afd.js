const express = require('express');
const { autenticar, permitir } = require('../middleware/auth');
const { gerarAfd, verificarIntegridadeCadeia } = require('../services/afd');

const router = express.Router();
router.use(autenticar);
// Documento fiscal/legal — restrito a admin, igual às demais configurações sensíveis.
router.use(permitir('admin'));

// GET /api/afd/exportar?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
router.get('/exportar', async (req, res) => {
  try {
    const { conteudo, nomeArquivo, avisos } = await gerarAfd({ empresaId: req.usuario.empresaId, dataInicio: req.query.dataInicio, dataFim: req.query.dataFim });
    if (req.query.formato === 'json') {
      return res.json({ nomeArquivo, avisos, conteudo });
    }
    res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('X-AFD-Avisos', encodeURIComponent(JSON.stringify(avisos)));
    return res.send(Buffer.from(conteudo, 'latin1'));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[afd] falha ao gerar arquivo:', err);
    return res.status(500).json({ erro: 'Falha ao gerar o AFD' });
  }
});

// GET /api/afd/integridade — confere se a cadeia de hash das marcações
// brutas está intacta (nenhum registro foi alterado fora da aplicação).
router.get('/integridade', async (req, res) => {
  const resultado = await verificarIntegridadeCadeia(req.usuario.empresaId);
  res.json(resultado);
});

module.exports = router;
