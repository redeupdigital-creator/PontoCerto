const express = require('express');
const { Abono, Colaborador } = require('../models');
const { autenticar, permitir, apenasProprioColaborador } = require('../middleware/auth');
const { notificar } = require('../services/notificacoes');
const { registrar } = require('../services/auditoria');

const router = express.Router();
router.use(autenticar);

// Listar: colaborador só vê os próprios; analista/coordenador/consulta/admin
// veem todos (com filtro opcional por colaboradorId).
router.get('/', apenasProprioColaborador(req => req.query.colaboradorId || req.usuario.colaboradorId), async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const colaboradorId = req.usuario.perfil === 'colaborador' ? req.usuario.colaboradorId : req.query.colaboradorId;
  if (colaboradorId) where.colaboradorId = colaboradorId;
  const abonos = await Abono.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json(abonos);
});

// Criar solicitação (esquecimento | liberado_gerencia | trabalho_externo | outro).
// Colaborador só solicita para si mesmo. Analista/coordenador/admin podem
// registrar em nome de qualquer colaborador (parte do fluxo operacional de
// tratar inconsistências de ponto). Consulta não solicita (é só leitura).
router.post('/', permitir('colaborador', 'analista', 'coordenador', 'admin'), apenasProprioColaborador(req => req.body.colaboradorId), async (req, res) => {
  const { colaboradorId, data, tipoMotivo, horarioInformado, justificativa } = req.body;
  if (!colaboradorId || !data || !tipoMotivo) {
    return res.status(400).json({ erro: 'Informe colaboradorId, data e tipoMotivo' });
  }
  const abono = await Abono.create({
    colaboradorId,
    data,
    tipoMotivo,
    horarioInformado,
    justificativa,
    solicitadoPor: req.usuario.login,
    status: 'pendente',
  });

  const colaborador = await Colaborador.findByPk(colaboradorId);
  await notificar({
    colaboradorId: null, // notificação ampla, para quem processa aprovações
    tipo: 'abono_pendente',
    titulo: 'Novo abono de batida aguardando aprovação',
    mensagem: `${colaborador ? colaborador.nome : 'Um colaborador'} solicitou abono para ${data} (${tipoMotivo}). Justificativa: ${justificativa || '—'}`,
    emailDestino: process.env.NOTIFICACAO_GESTOR_EMAIL || null,
  });

  res.status(201).json(abono);
});

// Aprovar (analista/coordenador/admin)
router.patch('/:id/aprovar', permitir('analista', 'coordenador', 'admin'), async (req, res) => {
  const abono = await Abono.findByPk(req.params.id);
  if (!abono) return res.status(404).json({ erro: 'Abono não encontrado' });
  await abono.update({ status: 'aprovado', aprovadorId: req.usuario.id, dataDecisao: new Date() });
  await registrar({ usuario: req.usuario, acao: 'aprovar', entidade: 'Abono', entidadeId: abono.id, detalhes: { colaboradorId: abono.colaboradorId, data: abono.data } });

  const colaborador = await Colaborador.findByPk(abono.colaboradorId);
  await notificar({
    colaboradorId: abono.colaboradorId,
    tipo: 'abono_aprovado',
    titulo: 'Seu abono de batida foi aprovado',
    mensagem: `O abono referente ao dia ${abono.data} foi aprovado.`,
    emailDestino: colaborador ? colaborador.email : null,
  });

  res.json(abono);
});

// Reprovar (analista/coordenador/admin)
router.patch('/:id/reprovar', permitir('analista', 'coordenador', 'admin'), async (req, res) => {
  const abono = await Abono.findByPk(req.params.id);
  if (!abono) return res.status(404).json({ erro: 'Abono não encontrado' });
  await abono.update({ status: 'reprovado', aprovadorId: req.usuario.id, dataDecisao: new Date() });
  await registrar({ usuario: req.usuario, acao: 'reprovar', entidade: 'Abono', entidadeId: abono.id, detalhes: { colaboradorId: abono.colaboradorId, data: abono.data } });

  const colaborador = await Colaborador.findByPk(abono.colaboradorId);
  await notificar({
    colaboradorId: abono.colaboradorId,
    tipo: 'abono_reprovado',
    titulo: 'Seu abono de batida foi reprovado',
    mensagem: `O abono referente ao dia ${abono.data} foi reprovado. Procure seu coordenador para mais detalhes.`,
    emailDestino: colaborador ? colaborador.email : null,
  });

  res.json(abono);
});

module.exports = router;
