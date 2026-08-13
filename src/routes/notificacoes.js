const express = require('express');
const { Notificacao } = require('../models');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Colaborador vê as suas + as amplas (colaboradorId null, ex: alerta que não é dele).
// Analista/coordenador/consulta/admin veem tudo DA MESMA EMPRESA (inclui as
// "amplas" destinadas à gestão, como abono pendente).
router.get('/', async (req, res) => {
  const { perfil, colaboradorId, empresaId } = req.usuario;
  const where = { empresaId };
  if (perfil === 'colaborador') {
    where.colaboradorId = colaboradorId;
  }
  // demais perfis: sem filtro adicional -> veem notificações amplas (colaboradorId null) e as suas, se houver, sempre dentro da própria empresa
  const notificacoes = await Notificacao.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  res.json(notificacoes);
});

router.get('/nao-lidas/total', async (req, res) => {
  const { perfil, colaboradorId, empresaId } = req.usuario;
  const where = { lida: false, empresaId };
  if (perfil === 'colaborador') where.colaboradorId = colaboradorId;
  const total = await Notificacao.count({ where });
  res.json({ total });
});

router.patch('/:id/lida', async (req, res) => {
  const notificacao = await Notificacao.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!notificacao) return res.status(404).json({ erro: 'Notificação não encontrada' });
  await notificacao.update({ lida: true });
  res.json(notificacao);
});

module.exports = router;
