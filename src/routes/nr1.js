const express = require('express');
const { Nr1Acao, Nr1Participacao, Colaborador, Abono } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');
const { invalidarCacheColaborador } = require('../services/calculo');
const { uploadDocumento } = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');
const { colaboradorDaEmpresa } = require('../utils/empresa');

const router = express.Router();
router.use(autenticar);
router.use(permitir('coordenador', 'consulta', 'admin'));

// ---- Ações (treinamentos, palestras, ginástica laboral, avaliação de risco etc.) ----

router.get('/acoes', async (req, res) => {
  const acoes = await Nr1Acao.findAll({ where: { empresaId: req.usuario.empresaId }, order: [['dataRealizacao', 'DESC']] });
  res.json(acoes);
});

router.post('/acoes', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
  const { titulo, tipo, dataRealizacao, descricao, cargaHorariaMin, geraAbono } = req.body;
  if (!titulo || !dataRealizacao) return res.status(400).json({ erro: 'Informe título e dataRealizacao' });

  let anexoPath = null;
  if (req.file) anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);

  const acao = await Nr1Acao.create({
    empresaId: req.usuario.empresaId,
    titulo, descricao, dataRealizacao,
    tipo: tipo || 'treinamento',
    cargaHorariaMin: parseInt(cargaHorariaMin, 10) || 0,
    geraAbono: geraAbono === 'false' ? false : geraAbono !== undefined ? !!geraAbono : true,
    anexoPath,
  });
  await registrar({ usuario: req.usuario, acao: 'create', entidade: 'Nr1Acao', entidadeId: acao.id, detalhes: { titulo } });
  res.status(201).json(acao);
});

router.delete('/acoes/:id', permitir('admin'), async (req, res) => {
  const acao = await Nr1Acao.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!acao) return res.status(404).json({ erro: 'Ação não encontrada' });
  await registrar({ usuario: req.usuario, acao: 'delete', entidade: 'Nr1Acao', entidadeId: acao.id, detalhes: { titulo: acao.titulo } });
  await acao.destroy();
  res.status(204).send();
});

// ---- Participantes de uma ação ----

router.get('/acoes/:id/participantes', async (req, res) => {
  const acao = await Nr1Acao.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!acao) return res.status(404).json({ erro: 'Ação não encontrada' });
  const participantes = await Nr1Participacao.findAll({
    where: { acaoId: req.params.id },
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula', 'cargo'] }],
  });
  res.json(participantes);
});

// Registra (ou atualiza) a participação de um colaborador na ação. Se a ação
// gera abono e horasAbonadas > 0, cria automaticamente um Abono já
// APROVADO para a data da ação — é a empresa quem está liberando o horário,
// não precisa de uma segunda aprovação manual depois.
router.post('/acoes/:id/participantes', permitir('coordenador', 'admin'), async (req, res) => {
  const acao = await Nr1Acao.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!acao) return res.status(404).json({ erro: 'Ação não encontrada' });
  const { colaboradorId, presente, horasAbonadas } = req.body;
  if (!colaboradorId) return res.status(400).json({ erro: 'Informe colaboradorId' });
  if (!(await colaboradorDaEmpresa(colaboradorId, req.usuario.empresaId))) return res.status(404).json({ erro: 'Colaborador não encontrado' });

  const horas = Number(horasAbonadas) || 0;
  const estaPresente = presente !== false;

  let abonoId = null;
  if (acao.geraAbono && estaPresente && horas > 0) {
    const abono = await Abono.create({
      colaboradorId,
      data: acao.dataRealizacao,
      tipoMotivo: 'liberado_gerencia',
      justificativa: `Participação na ação de NR-1: ${acao.titulo}`,
      solicitadoPor: req.usuario.login,
      status: 'aprovado',
      aprovadorId: req.usuario.id,
      dataDecisao: new Date(),
    });
    abonoId = abono.id;
    invalidarCacheColaborador(colaboradorId);
  }

  const [participacao] = await Nr1Participacao.findOrCreate({
    where: { acaoId: acao.id, colaboradorId },
    defaults: { presente: estaPresente, horasAbonadas: horas, abonoId },
  });
  await participacao.update({ presente: estaPresente, horasAbonadas: horas, abonoId: abonoId || participacao.abonoId });

  await registrar({
    usuario: req.usuario, acao: 'create', entidade: 'Nr1Participacao', entidadeId: participacao.id,
    detalhes: { acao: acao.titulo, colaboradorId, horasAbonadas: horas, abonoGerado: !!abonoId },
  });

  res.status(201).json(participacao);
});

router.delete('/participantes/:id', permitir('coordenador', 'admin'), async (req, res) => {
  const participacao = await Nr1Participacao.findByPk(req.params.id);
  if (!participacao || !(await colaboradorDaEmpresa(participacao.colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Registro não encontrado' });
  }
  await participacao.destroy();
  res.status(204).send();
});

module.exports = router;
