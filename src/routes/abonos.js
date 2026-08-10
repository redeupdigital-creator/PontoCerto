const express = require('express');
const { Op } = require('sequelize');
const { Abono, Colaborador } = require('../models');
const { autenticar, permitir, apenasProprioOuEquipe, idsDaEquipe } = require('../middleware/auth');
const { notificar } = require('../services/notificacoes');

const router = express.Router();
router.use(autenticar);

// Listar: colaborador só vê os próprios; gestor vê os da equipe (+ os próprios,
// se ele também tiver registros); RH/admin veem todos.
router.get('/', async (req, res) => {
  const { perfil, colaboradorId: proprioId } = req.usuario;
  const where = {};
  if (req.query.status) where.status = req.query.status;

  if (perfil === 'colaborador') {
    where.colaboradorId = proprioId;
  } else if (perfil === 'gestor') {
    if (req.query.colaboradorId) {
      const equipe = await idsDaEquipe(proprioId);
      if (req.query.colaboradorId !== proprioId && !equipe.includes(req.query.colaboradorId)) {
        return res.status(403).json({ erro: 'Você só pode acessar dados da sua equipe' });
      }
      where.colaboradorId = req.query.colaboradorId;
    } else {
      const equipe = await idsDaEquipe(proprioId);
      where.colaboradorId = { [Op.in]: [proprioId, ...equipe] };
    }
  } else if (req.query.colaboradorId) {
    where.colaboradorId = req.query.colaboradorId; // rh/admin com filtro opcional
  }

  const abonos = await Abono.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json(abonos);
});

// Criar solicitação (esquecimento | liberado_gerencia | trabalho_externo | outro)
// Colaborador só solicita para si; gestor só para si ou sua equipe; RH/admin livre.
router.post('/', apenasProprioOuEquipe(req => req.body.colaboradorId), async (req, res) => {
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
    colaboradorId: null, // notificação ampla, para quem gerencia aprovações
    tipo: 'abono_pendente',
    titulo: 'Novo abono de batida aguardando aprovação',
    mensagem: `${colaborador ? colaborador.nome : 'Um colaborador'} solicitou abono para ${data} (${tipoMotivo}). Justificativa: ${justificativa || '—'}`,
    emailDestino: process.env.NOTIFICACAO_GESTOR_EMAIL || null,
  });

  res.status(201).json(abono);
});

// Middleware compartilhado por aprovar/reprovar: gestor só decide sobre abonos
// da própria equipe; RH/admin decidem sobre qualquer um.
async function apenasEquipeDoAbono(req, res, next) {
  if (req.usuario.perfil === 'rh' || req.usuario.perfil === 'admin') return next();
  const abono = await Abono.findByPk(req.params.id);
  if (!abono) return res.status(404).json({ erro: 'Abono não encontrado' });
  const equipe = await idsDaEquipe(req.usuario.colaboradorId);
  if (!equipe.includes(abono.colaboradorId)) {
    return res.status(403).json({ erro: 'Você só pode aprovar/reprovar abonos da sua equipe' });
  }
  return next();
}

// Aprovar (gestor da equipe do colaborador, ou RH/admin)
router.patch('/:id/aprovar', permitir('gestor', 'rh', 'admin'), apenasEquipeDoAbono, async (req, res) => {
  const abono = await Abono.findByPk(req.params.id);
  if (!abono) return res.status(404).json({ erro: 'Abono não encontrado' });
  await abono.update({ status: 'aprovado', aprovadorId: req.usuario.id, dataDecisao: new Date() });

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

// Reprovar (gestor da equipe do colaborador, ou RH/admin)
router.patch('/:id/reprovar', permitir('gestor', 'rh', 'admin'), apenasEquipeDoAbono, async (req, res) => {
  const abono = await Abono.findByPk(req.params.id);
  if (!abono) return res.status(404).json({ erro: 'Abono não encontrado' });
  await abono.update({ status: 'reprovado', aprovadorId: req.usuario.id, dataDecisao: new Date() });

  const colaborador = await Colaborador.findByPk(abono.colaboradorId);
  await notificar({
    colaboradorId: abono.colaboradorId,
    tipo: 'abono_reprovado',
    titulo: 'Seu abono de batida foi reprovado',
    mensagem: `O abono referente ao dia ${abono.data} foi reprovado. Procure seu gestor para mais detalhes.`,
    emailDestino: colaborador ? colaborador.email : null,
  });

  res.json(abono);
});

module.exports = router;
