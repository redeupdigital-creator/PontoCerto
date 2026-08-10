const express = require('express');
const { Op } = require('sequelize');
const { Colaborador } = require('../models');
const { autenticar, permitir, apenasProprioOuEquipe, idsDaEquipe } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');

const router = express.Router();
router.use(autenticar);

// Listar: colaborador só se vê a si mesmo; gestor vê a si + sua equipe; RH/admin veem todos.
router.get('/', async (req, res) => {
  const { perfil, colaboradorId } = req.usuario;
  let where = {};
  if (perfil === 'colaborador') {
    where = { id: colaboradorId };
  } else if (perfil === 'gestor') {
    const equipe = await idsDaEquipe(colaboradorId);
    where = { id: { [Op.in]: [colaboradorId, ...equipe] } };
  }
  const colaboradores = await Colaborador.findAll({ where, order: [['nome', 'ASC']] });
  res.json(colaboradores);
});

// Buscar um (mesmo escopo: próprio, equipe do gestor, ou irrestrito para rh/admin)
router.get('/:id', apenasProprioOuEquipe(req => req.params.id), async (req, res) => {
  const colaborador = await Colaborador.findByPk(req.params.id);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  res.json(colaborador);
});

// Criar (RH/admin), com upload de foto opcional (campo "foto")
router.post('/', permitir('rh', 'admin'), upload.single('foto'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.jornada && typeof body.jornada === 'string') body.jornada = JSON.parse(body.jornada);
    if (req.file) body.fotoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
    const colaborador = await Colaborador.create(body);
    res.status(201).json(colaborador);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar
router.put('/:id', permitir('rh', 'admin'), upload.single('foto'), async (req, res) => {
  try {
    const colaborador = await Colaborador.findByPk(req.params.id);
    if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const body = { ...req.body };
    if (body.jornada && typeof body.jornada === 'string') body.jornada = JSON.parse(body.jornada);
    if (req.file) body.fotoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
    await colaborador.update(body);
    res.json(colaborador);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Remover
router.delete('/:id', permitir('rh', 'admin'), async (req, res) => {
  const colaborador = await Colaborador.findByPk(req.params.id);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  await colaborador.destroy();
  res.status(204).send();
});

module.exports = router;
