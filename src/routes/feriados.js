const express = require('express');
const { Feriado } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const feriados = await Feriado.findAll({ where: { empresaId: req.usuario.empresaId }, order: [['data', 'ASC']] });
  res.json(feriados);
});

router.post('/', permitir('admin'), async (req, res) => {
  const feriado = await Feriado.create({ ...req.body, empresaId: req.usuario.empresaId });
  res.status(201).json(feriado);
});

router.delete('/:id', permitir('admin'), async (req, res) => {
  const feriado = await Feriado.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!feriado) return res.status(404).json({ erro: 'Feriado não encontrado' });
  await feriado.destroy();
  res.status(204).send();
});

module.exports = router;
