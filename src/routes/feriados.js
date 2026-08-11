const express = require('express');
const { Feriado } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const feriados = await Feriado.findAll({ order: [['data', 'ASC']] });
  res.json(feriados);
});

router.post('/', permitir('admin'), async (req, res) => {
  const feriado = await Feriado.create(req.body);
  res.status(201).json(feriado);
});

router.delete('/:id', permitir('admin'), async (req, res) => {
  const feriado = await Feriado.findByPk(req.params.id);
  if (!feriado) return res.status(404).json({ erro: 'Feriado não encontrado' });
  await feriado.destroy();
  res.status(204).send();
});

module.exports = router;
