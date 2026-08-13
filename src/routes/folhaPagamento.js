const express = require('express');
const { Op } = require('sequelize');
const { Holerite } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');
const { uploadDocumento } = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');
const { colaboradorDaEmpresa, idsColaboradoresDaEmpresa } = require('../utils/empresa');

const router = express.Router();
router.use(autenticar);

// Colaborador vê os próprios holerites. Coordenador/consulta/admin veem
// todos DA MESMA EMPRESA (com filtro opcional). Analista fica de fora — é
// assunto de RH/financeiro, fora do escopo de "ponto e abono".
router.get('/holerites', permitir('colaborador', 'coordenador', 'consulta', 'admin'), async (req, res) => {
  const { perfil, colaboradorId: proprioId, empresaId } = req.usuario;
  const where = {};
  if (perfil === 'colaborador') {
    where.colaboradorId = proprioId;
  } else if (req.query.colaboradorId) {
    if (!(await colaboradorDaEmpresa(req.query.colaboradorId, empresaId))) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    where.colaboradorId = req.query.colaboradorId;
  } else {
    where.colaboradorId = { [Op.in]: await idsColaboradoresDaEmpresa(empresaId) };
  }
  if (req.query.competencia) where.competencia = req.query.competencia;
  const registros = await Holerite.findAll({ where, order: [['competencia', 'DESC']] });
  res.json(registros);
});

router.post('/holerites', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
  const { colaboradorId, competencia, valorBruto, valorLiquido, descontosTexto, dataPagamento } = req.body;
  if (!colaboradorId || !competencia) return res.status(400).json({ erro: 'Informe colaboradorId e competencia (YYYY-MM)' });
  if (!(await colaboradorDaEmpresa(colaboradorId, req.usuario.empresaId))) return res.status(404).json({ erro: 'Colaborador não encontrado' });

  let anexoPath = null;
  if (req.file) anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);

  try {
    const registro = await Holerite.create({
      colaboradorId, competencia, valorBruto: valorBruto || null, valorLiquido: valorLiquido || null,
      descontosTexto: descontosTexto || null, dataPagamento: dataPagamento || null, anexoPath,
    });
    await registrar({ usuario: req.usuario, acao: 'create', entidade: 'Holerite', entidadeId: registro.id, detalhes: { colaboradorId, competencia } });
    res.status(201).json(registro);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ erro: 'Já existe um holerite para este colaborador nessa competência' });
    }
    res.status(500).json({ erro: err.message });
  }
});

router.put('/holerites/:id', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
  const registro = await Holerite.findByPk(req.params.id);
  if (!registro || !(await colaboradorDaEmpresa(registro.colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Holerite não encontrado' });
  }
  const body = { ...req.body };
  if (req.file) body.anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
  await registro.update(body);
  await registrar({ usuario: req.usuario, acao: 'update', entidade: 'Holerite', entidadeId: registro.id, detalhes: body });
  res.json(registro);
});

router.delete('/holerites/:id', permitir('admin'), async (req, res) => {
  const registro = await Holerite.findByPk(req.params.id);
  if (!registro || !(await colaboradorDaEmpresa(registro.colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Holerite não encontrado' });
  }
  await registrar({ usuario: req.usuario, acao: 'delete', entidade: 'Holerite', entidadeId: registro.id, detalhes: { competencia: registro.competencia } });
  await registro.destroy();
  res.status(204).send();
});

module.exports = router;
