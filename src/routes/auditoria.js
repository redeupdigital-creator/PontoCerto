const express = require('express');
const { Op } = require('sequelize');
const { Auditoria } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);
router.use(permitir('admin'));

// GET /api/auditoria?entidade=&entidadeId=&usuarioId=&dataInicio=&dataFim=&limit=&pagina=
router.get('/', async (req, res) => {
  const where = { empresaId: req.usuario.empresaId };
  if (req.query.entidade) where.entidade = req.query.entidade;
  if (req.query.entidadeId) where.entidadeId = req.query.entidadeId;
  if (req.query.usuarioId) where.usuarioId = req.query.usuarioId;
  if (req.query.dataInicio || req.query.dataFim) {
    where.createdAt = {};
    if (req.query.dataInicio) where.createdAt[Op.gte] = new Date(`${req.query.dataInicio}T00:00:00`);
    if (req.query.dataFim) where.createdAt[Op.lte] = new Date(`${req.query.dataFim}T23:59:59`);
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const offset = (pagina - 1) * limit;

  const { count, rows } = await Auditoria.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset });

  // Compatibilidade: quem já consumia isso como array puro (uso interno,
  // telas antigas) continua funcionando — a paginação vem via cabeçalhos.
  res.setHeader('X-Total-Count', count);
  res.setHeader('X-Pagina', pagina);
  res.setHeader('X-Total-Paginas', Math.ceil(count / limit) || 1);
  res.json(rows.map((r) => ({ ...r.get({ plain: true }), detalhes: r.detalhes ? JSON.parse(r.detalhes) : null })));
});

module.exports = router;
