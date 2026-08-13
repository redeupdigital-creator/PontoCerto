const express = require('express');
const { Op } = require('sequelize');
const { EpiSolicitacao } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');
const { uploadDocumento } = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');
const { colaboradorDaEmpresa, idsColaboradoresDaEmpresa } = require('../utils/empresa');

const router = express.Router();
router.use(autenticar);

// Colaborador: só as próprias. Coordenador/consulta/admin: todas DA MESMA EMPRESA.
router.get('/', permitir('colaborador', 'coordenador', 'consulta', 'admin'), async (req, res) => {
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
  if (req.query.status) where.status = req.query.status;
  const registros = await EpiSolicitacao.findAll({ where, order: [['dataSolicitacao', 'DESC']] });
  res.json(registros);
});

// Colaborador pode solicitar EPI pra si mesmo; coordenador/admin pra qualquer um.
router.post('/', permitir('colaborador', 'coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
  const { perfil, colaboradorId: proprioId, empresaId } = req.usuario;
  const colaboradorId = perfil === 'colaborador' ? proprioId : req.body.colaboradorId;
  if (!colaboradorId) return res.status(400).json({ erro: 'Informe colaboradorId' });
  if (!req.body.item) return res.status(400).json({ erro: 'Informe o item do EPI' });
  if (!(await colaboradorDaEmpresa(colaboradorId, empresaId))) return res.status(404).json({ erro: 'Colaborador não encontrado' });

  let anexoPath = null;
  if (req.file) anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);

  const registro = await EpiSolicitacao.create({
    colaboradorId,
    item: req.body.item,
    quantidade: parseInt(req.body.quantidade, 10) || 1,
    motivo: req.body.motivo || null,
    dataSolicitacao: req.body.dataSolicitacao || new Date().toISOString().slice(0, 10),
    observacao: req.body.observacao || null,
    anexoPath,
  });
  await registrar({ usuario: req.usuario, acao: 'create', entidade: 'EpiSolicitacao', entidadeId: registro.id, detalhes: { colaboradorId, item: registro.item } });
  res.status(201).json(registro);
});

// Marcar como entregue/cancelado, e anexar comprovante de entrega assinado
router.put('/:id', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
  const registro = await EpiSolicitacao.findByPk(req.params.id);
  if (!registro || !(await colaboradorDaEmpresa(registro.colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Solicitação não encontrada' });
  }
  const body = { ...req.body };
  if (req.file) body.anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
  await registro.update(body);
  await registrar({ usuario: req.usuario, acao: 'update', entidade: 'EpiSolicitacao', entidadeId: registro.id, detalhes: body });
  res.json(registro);
});

router.delete('/:id', permitir('admin'), async (req, res) => {
  const registro = await EpiSolicitacao.findByPk(req.params.id);
  if (!registro || !(await colaboradorDaEmpresa(registro.colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Solicitação não encontrada' });
  }
  await registrar({ usuario: req.usuario, acao: 'delete', entidade: 'EpiSolicitacao', entidadeId: registro.id, detalhes: { item: registro.item } });
  await registro.destroy();
  res.status(204).send();
});

module.exports = router;
