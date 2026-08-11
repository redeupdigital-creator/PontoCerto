const express = require('express');
const { autenticar, permitir } = require('../middleware/auth');
const { montarPainelAoVivo } = require('../services/dashboardAoVivo');

const router = express.Router();
router.use(autenticar);
// Visão da empresa toda — mesmo público dos relatórios (analista fica de
// fora, seu escopo é só ponto/abono individual; colaborador só vê a si mesmo
// nas outras telas).
router.use(permitir('coordenador', 'consulta', 'admin'));

router.get('/hoje', async (req, res) => {
  try {
    const painel = await montarPainelAoVivo();
    res.json(painel);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard] falha ao montar painel:', err);
    res.status(500).json({ erro: 'Falha ao montar o painel ao vivo' });
  }
});

module.exports = router;
