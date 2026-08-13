const express = require('express');
const { Batida } = require('../models');
const { autenticar, apenasProprioColaborador, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');
const { registrarMarcacaoBruta } = require('../services/afd');
const { invalidarCacheColaborador } = require('../services/calculo');
const { colaboradorDaEmpresa } = require('../utils/empresa');

const router = express.Router();
router.use(autenticar);

// GET /api/batidas?colaboradorId=&mes=2026-08
router.get('/', apenasProprioColaborador(req => req.query.colaboradorId), async (req, res) => {
  const { colaboradorId, mes } = req.query;
  if (!colaboradorId || !mes) return res.status(400).json({ erro: 'Informe colaboradorId e mes (YYYY-MM)' });
  if (!(await colaboradorDaEmpresa(colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Colaborador não encontrado' });
  }
  const { Op } = require('sequelize');
  const inicio = `${mes}-01`;
  const fim = `${mes}-31`;
  const batidas = await Batida.findAll({ where: { colaboradorId, data: { [Op.between]: [inicio, fim] } } });
  res.json(batidas);
});

// PUT /api/batidas  -> cria ou atualiza a batida de um dia (upsert por colaboradorId+data)
// Lançamento direto de horário: analista/coordenador/admin. O colaborador
// bate o próprio ponto pelo app (POST /bater) ou reporta inconsistência via
// abono (POST /api/abonos). Consulta é só leitura, não lança nada.
router.put('/', permitir('analista', 'coordenador', 'admin'), async (req, res) => {
  const { colaboradorId, data, e1, s1, e2, s2, origem } = req.body;
  if (!colaboradorId || !data) return res.status(400).json({ erro: 'Informe colaboradorId e data' });
  if (!(await colaboradorDaEmpresa(colaboradorId, req.usuario.empresaId))) {
    return res.status(404).json({ erro: 'Colaborador não encontrado' });
  }

  const [batida] = await Batida.findOrCreate({
    where: { colaboradorId, data },
    defaults: { colaboradorId, data, e1, s1, e2, s2, origem: origem || 'manual' },
  });
  const antes = { e1: batida.e1, s1: batida.s1, e2: batida.e2, s2: batida.s2 };
  await batida.update({ e1, s1, e2, s2, origem: origem || batida.origem });
  invalidarCacheColaborador(colaboradorId);
  await registrar({
    usuario: req.usuario, acao: 'update', entidade: 'Batida', entidadeId: batida.id,
    detalhes: { colaboradorId, data, antes, depois: { e1, s1, e2, s2 } },
  });
  res.json(batida);
});

// Formata a hora atual como "HH:MM", respeitando o timezone configurado no
// servidor (variável de ambiente TZ — ver .env.example / README).
function horaAtual() {
  const agora = new Date();
  return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
}
function dataAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

const ORDEM_SLOTS = ['e1', 's1', 'e2', 's2'];
const ROTULO_SLOT = { e1: 'Entrada', s1: 'Saída (intervalo)', e2: 'Volta (intervalo)', s2: 'Saída' };

// POST /api/batidas/bater  -> auto-atendimento: o próprio usuário logado
// (qualquer perfil, desde que vinculado a um colaborador) registra a batida
// de AGORA. Preenche automaticamente o próximo horário vazio do dia, com
// geolocalização opcional capturada pelo navegador/app no momento do toque.
router.post('/bater', async (req, res) => {
  const colaboradorId = req.usuario.colaboradorId;
  if (!colaboradorId) {
    return res.status(400).json({ erro: 'Este usuário não está vinculado a um colaborador — não é possível bater ponto.' });
  }

  const { latitude, longitude, precisao, coletor } = req.body || {};
  const data = dataAtual();

  const [batida] = await Batida.findOrCreate({
    where: { colaboradorId, data },
    defaults: { colaboradorId, data, origem: 'app' },
  });

  const proximoSlot = ORDEM_SLOTS.find((slot) => !batida[slot]);
  if (!proximoSlot) {
    return res.status(409).json({ erro: 'Todas as 4 batidas de hoje já foram registradas.' });
  }

  const hora = horaAtual();
  const agora = new Date();
  const atualizacao = { [proximoSlot]: hora, origem: 'app' };
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    atualizacao[`${proximoSlot}Lat`] = latitude;
    atualizacao[`${proximoSlot}Lng`] = longitude;
    atualizacao[`${proximoSlot}Precisao`] = typeof precisao === 'number' ? precisao : null;
  }
  await batida.update(atualizacao);
  invalidarCacheColaborador(colaboradorId);

  // Registro imutável, numerado (NSR) e encadeado por hash — é a marcação de
  // ponto de verdade, para fins do AFD (Portaria 671/2021). Não bloqueia a
  // resposta ao usuário se falhar (o registro de exibição já foi salvo).
  let registroAfd = null;
  try {
    registroAfd = await registrarMarcacaoBruta({ empresaId: req.usuario.empresaId, colaboradorId, dataHoraMarcacao: agora, origem: coletor === 'browser' ? 'browser' : 'app' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[afd] falha ao registrar marcação bruta (não bloqueia a batida):', err.message);
  }

  res.json({
    slot: proximoSlot,
    rotulo: ROTULO_SLOT[proximoSlot],
    hora,
    data,
    comGeolocalizacao: typeof latitude === 'number' && typeof longitude === 'number',
    nsr: registroAfd ? registroAfd.nsr : null,
    batida,
  });
});

module.exports = router;
