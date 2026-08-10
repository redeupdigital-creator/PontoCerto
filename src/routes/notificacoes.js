const express = require('express');
const { Op } = require('sequelize');
const { Notificacao } = require('../models');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Colaborador vê as suas + as amplas (colaboradorId null, ex: alerta que não é dele).
// RH/gestor/admin veem tudo (inclui as "amplas" destinadas à gestão, como abono pendente).
router.get('/', async (req, res) => {
  const { perfil, colaboradorId } = req.usuario;
  const where = {};
  if (perfil === 'colaborador') {
    where.colaboradorId = colaboradorId;
  }
  // gestor/rh/admin: sem filtro -> veem notificações amplas (colaboradorId null) e as suas, se houver
  const notificacoes = await Notificacao.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  res.json(notificacoes);
});

router.get('/nao-lidas/total', async (req, res) => {
  const { perfil, colaboradorId } = req.usuario;
  const where = { lida: false };
  if (perfil === 'colaborador') where.colaboradorId = colaboradorId;
  const total = await Notificacao.count({ where });
  res.json({ total });
});

router.patch('/:id/lida', async (req, res) => {
  const notificacao = await Notificacao.findByPk(req.params.id);
  if (!notificacao) return res.status(404).json({ erro: 'Notificação não encontrada' });
  await notificacao.update({ lida: true });
  res.json(notificacao);
});

module.exports = router;
