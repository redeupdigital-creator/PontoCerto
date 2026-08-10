const { Op } = require('sequelize');
const { Batida, Abono, Ferias, Atestado, Ocorrencia, Feriado } = require('../models');

const DIA_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minToTime(min) {
  if (min === null || Number.isNaN(min)) return '0:00';
  const sign = min < 0 ? '-' : '';
  min = Math.abs(Math.round(min));
  return `${sign}${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dateStr(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function jornadaPrevistaMin(colaborador, dow) {
  const jornada = colaborador.jornada || {};
  return (jornada[DIA_KEYS[dow]] || 0) * 60;
}

/**
 * Calcula o dia de ponto de um colaborador (trabalhado, atraso, extra, falta)
 * considerando batidas, feriados, abonos aprovados e ausências (férias/atestado/suspensão).
 */
async function calcularDia(colaborador, y, m, d, context) {
  const dstr = dateStr(y, m, d);
  const dow = new Date(y, m - 1, d).getDay();

  const batida = context.batidasPorData[dstr];
  const e1 = timeToMin(batida?.e1);
  const s1 = timeToMin(batida?.s1);
  const e2 = timeToMin(batida?.e2);
  const s2 = timeToMin(batida?.s2);

  let trabalhado = 0;
  if (e1 !== null && s1 !== null) trabalhado += Math.max(0, s1 - e1);
  if (e2 !== null && s2 !== null) trabalhado += Math.max(0, s2 - e2);

  const feriado = context.feriados.has(dstr);
  const prevista = feriado ? 0 : jornadaPrevistaMin(colaborador, dow);

  const abonado = context.abonosAprovados.has(dstr);

  const ausencia = buscarAusencia(context, dstr);

  let atraso = 0;
  let extra = 0;
  if (!ausencia) {
    if (trabalhado < prevista && !abonado) atraso = prevista - trabalhado;
    if (trabalhado > prevista) extra = trabalhado - prevista;
  }

  const falta = prevista > 0 && trabalhado === 0 && !abonado && !ausencia;

  return {
    data: dstr,
    diaSemana: dow,
    batida: batida || {},
    minutosTrabalhados: trabalhado,
    minutosPrevistos: prevista,
    minutosAtraso: atraso,
    minutosExtra: extra,
    feriado,
    abonado,
    ausencia,
    falta,
    horasTrabalhadas: minToTime(trabalhado),
    horasAtraso: minToTime(atraso),
    horasExtra: minToTime(extra),
  };
}

function buscarAusencia(context, dstr) {
  const ferias = context.ferias.find((f) => dstr >= f.dataInicioGozo && dstr <= f.dataFimGozo);
  if (ferias) return { tipo: 'ferias', referenciaId: ferias.id };
  const atestado = context.atestados.find((a) => dstr >= a.dataInicio && dstr <= a.dataFim);
  if (atestado) return { tipo: 'atestado', referenciaId: atestado.id };
  const suspensao = context.ocorrencias.find(
    (o) => o.tipo === 'suspensao' && dstr >= o.dataInicio && dstr <= (o.dataFim || o.dataInicio)
  );
  if (suspensao) return { tipo: 'suspensao', referenciaId: suspensao.id };
  return null;
}

/**
 * Monta o contexto do mês (busca tudo de uma vez) e calcula todos os dias.
 * Retorna { dias: [...], totais: {...} }
 */
async function calcularMes(colaborador, ano, mes) {
  const nd = daysInMonth(ano, mes);
  const inicio = dateStr(ano, mes, 1);
  const fim = dateStr(ano, mes, nd);

  const [batidas, abonos, feriados, ferias, atestados, ocorrencias] = await Promise.all([
    Batida.findAll({ where: { colaboradorId: colaborador.id, data: { [Op.between]: [inicio, fim] } } }),
    Abono.findAll({ where: { colaboradorId: colaborador.id, status: 'aprovado', data: { [Op.between]: [inicio, fim] } } }),
    Feriado.findAll({ where: { data: { [Op.between]: [inicio, fim] } } }),
    Ferias.findAll({ where: { colaboradorId: colaborador.id } }),
    Atestado.findAll({ where: { colaboradorId: colaborador.id } }),
    Ocorrencia.findAll({ where: { colaboradorId: colaborador.id } }),
  ]);

  const context = {
    batidasPorData: Object.fromEntries(batidas.map((b) => [b.data, b])),
    abonosAprovados: new Set(abonos.map((a) => a.data)),
    feriados: new Set(feriados.map((f) => f.data)),
    ferias: ferias.map((f) => f.get({ plain: true })),
    atestados: atestados.map((a) => a.get({ plain: true })),
    ocorrencias: ocorrencias.map((o) => o.get({ plain: true })),
  };

  const dias = [];
  let totalTrabalhado = 0;
  let totalAtraso = 0;
  let totalExtra = 0;
  let totalFaltas = 0;

  for (let d = 1; d <= nd; d += 1) {
    // eslint-disable-next-line no-await-in-loop
    const dia = await calcularDia(colaborador, ano, mes, d, context);
    dias.push(dia);
    totalTrabalhado += dia.minutosTrabalhados;
    totalAtraso += dia.minutosAtraso;
    totalExtra += dia.minutosExtra;
    if (dia.falta) totalFaltas += 1;
  }

  return {
    dias,
    totais: {
      trabalhado: minToTime(totalTrabalhado),
      atraso: minToTime(totalAtraso),
      extra: minToTime(totalExtra),
      faltas: totalFaltas,
    },
  };
}

module.exports = { calcularMes, calcularDia, minToTime, timeToMin, daysInMonth, dateStr };
