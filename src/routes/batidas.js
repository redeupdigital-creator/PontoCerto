const express = require('express');
const { Batida } = require('../models');
const { autenticar, apenasProprioOuEquipe, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/batidas?colaboradorId=&mes=2026-08
router.get('/', apenasProprioOuEquipe(req => req.query.colaboradorId), async (req, res) => {
  const { colaboradorId, mes } = req.query;
  if (!colaboradorId || !mes) return res.status(400).json({ erro: 'Informe colaboradorId e mes (YYYY-MM)' });
  const { Op } = require('sequelize');
  const inicio = `${mes}-01`;
  const fim = `${mes}-31`;
  const batidas = await Batida.findAll({ where: { colaboradorId, data: { [Op.between]: [inicio, fim] } } });
  res.json(batidas);
});

// PUT /api/batidas  -> cria ou atualiza a batida de um dia (upsert por colaboradorId+data)
// Lançamento direto de horário é tarefa de RH/gestor (restrito à própria equipe,
// no caso do gestor); o colaborador reporta inconsistências pelo fluxo de
// Abono de Batidas (POST /api/abonos), ou bate o próprio ponto pelo app (ver abaixo).
router.put('/', permitir('rh', 'admin', 'gestor'), apenasProprioOuEquipe(req => req.body.colaboradorId), async (req, res) => {
  const { colaboradorId, data, e1, s1, e2, s2, origem } = req.body;
  if (!colaboradorId || !data) return res.status(400).json({ erro: 'Informe colaboradorId e data' });

  const [batida] = await Batida.findOrCreate({
    where: { colaboradorId, data },
    defaults: { colaboradorId, data, e1, s1, e2, s2, origem: origem || 'manual' },
  });
  await batida.update({ e1, s1, e2, s2, origem: origem || batida.origem });
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

// POST /api/batidas/bater  -> auto-atendimento: o próprio colaborador registra
// a batida de AGORA (usado pelo app mobile). Preenche automaticamente o
// próximo horário vazio do dia (entrada -> saída intervalo -> volta -> saída),
// com geolocalização opcional capturada pelo navegador/app no momento do toque.
router.post('/bater', async (req, res) => {
  const colaboradorId = req.usuario.colaboradorId;
  if (!colaboradorId) {
    return res.status(400).json({ erro: 'Este usuário não está vinculado a um colaborador — não é possível bater ponto.' });
  }

  const { latitude, longitude, precisao } = req.body || {};
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
  const atualizacao = { [proximoSlot]: hora, origem: 'app' };
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    atualizacao[`${proximoSlot}Lat`] = latitude;
    atualizacao[`${proximoSlot}Lng`] = longitude;
    atualizacao[`${proximoSlot}Precisao`] = typeof precisao === 'number' ? precisao : null;
  }
  await batida.update(atualizacao);

  res.json({
    slot: proximoSlot,
    rotulo: ROTULO_SLOT[proximoSlot],
    hora,
    data,
    comGeolocalizacao: typeof latitude === 'number' && typeof longitude === 'number',
    batida,
  });
});

module.exports = router;
