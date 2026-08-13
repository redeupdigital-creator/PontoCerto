const { Op } = require('sequelize');
const { Batida, Abono, Ferias, Atestado, Ocorrencia, Feriado, JornadaVersao } = require('../models');

const DIA_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const INICIO_NOTURNO_MIN = 22 * 60; // 22:00
const FIM_DIA_MIN = 24 * 60; // meia-noite
const ADICIONAL_NOTURNO_PERCENTUAL = 0.2; // +20% conforme CLT art. 73
const INTERVALO_MINIMO_MIN = 60; // 1h, obrigatório para jornada > 6h (CLT art. 71)
const JORNADA_MINIMA_PARA_INTERVALO = 6 * 60;

// Cache em memória de `calcularMes`, com TTL curto. O motivo de existir: o
// Painel ao Vivo recalcula o mês inteiro de CADA colaborador a cada 30s
// (para mostrar faltas/atrasos do mês) — sem cache, isso fica caro rápido
// conforme a empresa cresce. Para nunca mostrar dado desatualizado depois de
// uma edição, toda rota que grava algo que afeta o cálculo (batida, abono,
// ausência) chama `invalidarCacheColaborador` — o TTL aqui é só uma rede de
// segurança, não a garantia principal de atualização.
const TTL_CACHE_MES_MS = 5 * 60 * 1000; // 5 minutos
const cacheMes = new Map(); // chave: "colaboradorId:ano-mes" -> { resultado, expiraEm }

function invalidarCacheColaborador(colaboradorId) {
  for (const chave of cacheMes.keys()) {
    if (chave.startsWith(`${colaboradorId}:`)) cacheMes.delete(chave);
  }
}
function invalidarCacheMes(colaboradorId, ano, mes) {
  cacheMes.delete(`${colaboradorId}:${ano}-${mes}`);
}

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

function jornadaPrevistaMin(jornada, dow) {
  return ((jornada || {})[DIA_KEYS[dow]] || 0) * 60;
}

/**
 * Retorna a VERSÃO de jornada vigente numa data específica (não só o objeto
 * de horas por dia da semana — o registro completo, incluindo tipo de
 * escala). Isso garante que meses passados continuem calculados com a
 * jornada que valia naquela época, mesmo que ela já tenha mudado depois.
 * Se não houver nenhuma versão cobrindo a data (dado legado antes do
 * versionamento existir), sintetiza uma versão "semanal" com
 * `jornadaAtualFallback`.
 */
function buscarJornadaVigente(versoes, dstr, jornadaAtualFallback) {
  const candidatas = versoes.filter((v) => v.vigenciaInicio <= dstr && (!v.vigenciaFim || v.vigenciaFim >= dstr));
  if (candidatas.length === 0) {
    return { jornada: jornadaAtualFallback || {}, tipoEscala: 'semanal', ciclo: null, dataReferenciaCiclo: null };
  }
  // Se por algum motivo houver mais de uma cobrindo a data (não deveria),
  // usa a de início mais recente.
  candidatas.sort((a, b) => (a.vigenciaInicio < b.vigenciaInicio ? 1 : -1));
  const v = candidatas[0];
  return { jornada: v.jornada, tipoEscala: v.tipoEscala || 'semanal', ciclo: v.ciclo || null, dataReferenciaCiclo: v.dataReferenciaCiclo || null };
}

/**
 * Minutos previstos de trabalho numa data, considerando o tipo de escala:
 * - "semanal" (padrão): olha só o dia da semana (ex.: seg=8h).
 * - "ciclica": conta quantos dias se passaram desde `dataReferenciaCiclo` e
 *   usa esse deslocamento (módulo o tamanho do ciclo) para escolher a
 *   posição no array `ciclo` — é assim que 12x36, 6x1 etc. funcionam, já
 *   que não seguem o dia da semana, seguem uma contagem contínua de dias.
 */
function previstaMinParaData(versaoVigente, dstr, dow) {
  if (versaoVigente.tipoEscala === 'ciclica' && Array.isArray(versaoVigente.ciclo) && versaoVigente.ciclo.length > 0 && versaoVigente.dataReferenciaCiclo) {
    const diffMs = new Date(`${dstr}T00:00:00Z`) - new Date(`${versaoVigente.dataReferenciaCiclo}T00:00:00Z`);
    const diffDias = Math.round(diffMs / 86400000);
    let posicao = diffDias % versaoVigente.ciclo.length;
    if (posicao < 0) posicao += versaoVigente.ciclo.length;
    return (versaoVigente.ciclo[posicao] || 0) * 60;
  }
  return jornadaPrevistaMin(versaoVigente.jornada, dow);
}

/**
 * Minutos de um período [e,s) (em minutos desde 00:00, mesmo dia) que caem
 * dentro da janela de adicional noturno (22:00–24:00). Limitação conhecida:
 * não cobre o trecho de 00:00–05:00 quando o turno atravessa a meia-noite,
 * porque o modelo atual de batida (e1/s1/e2/s2) representa só um dia por
 * registro — ver README para o plano de evolução disso.
 */
function minutosNoturnos(e, s) {
  if (e === null || s === null || s <= e) return 0;
  const inicio = Math.max(e, INICIO_NOTURNO_MIN);
  const fim = Math.min(s, FIM_DIA_MIN);
  return Math.max(0, fim - inicio);
}

/**
 * Calcula o dia de ponto de um colaborador (trabalhado, atraso, extra, falta,
 * adicional noturno, intervalo) considerando batidas, feriados, abonos
 * aprovados, ausências (férias/atestado/suspensão) e a jornada vigente na data.
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
  const jornadaVigente = buscarJornadaVigente(context.jornadaVersoes, dstr, colaborador.jornada);
  const prevista = feriado ? 0 : previstaMinParaData(jornadaVigente, dstr, dow);

  const abonado = context.abonosAprovados.has(dstr);
  const ausencia = buscarAusencia(context, dstr);

  // Dias futuros (além de hoje) ainda não aconteceram — não têm falta nem
  // atraso a apurar. Sem essa checagem, todo dia restante do mês corrente
  // era contado como falta, o que inflava o relatório de forma incorreta.
  const ehFuturo = context.hoje ? dstr > context.hoje : false;

  let atraso = 0;
  let extra = 0;
  if (!ausencia && !ehFuturo) {
    if (trabalhado < prevista && !abonado) atraso = prevista - trabalhado;
    if (trabalhado > prevista) extra = trabalhado - prevista;
  }

  const falta = !ehFuturo && prevista > 0 && trabalhado === 0 && !abonado && !ausencia;

  // "Atraso" para fins de contagem de dias (relatórios/painel) respeita a
  // tolerância do colaborador — poucos minutos de diferença não devem contar
  // como um dia de atraso.
  const tolerancia = Number(colaborador.toleranciaMin) || 0;
  const diaComAtraso = atraso > tolerancia;

  // Adicional noturno (CLT art. 73): soma o tempo trabalhado entre 22h e
  // meia-noite nos dois períodos do dia, e converte em minutos "equivalentes"
  // ao acréscimo de 20% — é um indicador para a folha, não substitui o
  // cálculo definitivo do sistema de folha de pagamento.
  const minNoturnos = minutosNoturnos(e1, s1) + minutosNoturnos(e2, s2);
  const adicionalNoturnoMin = Math.round(minNoturnos * ADICIONAL_NOTURNO_PERCENTUAL);

  // Intervalo intrajornada (CLT art. 71): mínimo 1h quando a jornada prevista
  // do dia é maior que 6h.
  const intervaloMin = (s1 !== null && e2 !== null) ? Math.max(0, e2 - s1) : null;
  const exigeIntervalo = !feriado && !ausencia && !ehFuturo && prevista > JORNADA_MINIMA_PARA_INTERVALO;
  const intervaloInsuficiente = exigeIntervalo && (intervaloMin === null || intervaloMin < INTERVALO_MINIMO_MIN) && trabalhado > 0;

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
    diaComAtraso,
    ehFuturo,
    horasTrabalhadas: minToTime(trabalhado),
    horasAtraso: minToTime(atraso),
    horasExtra: minToTime(extra),
    minutosNoturnos: minNoturnos,
    adicionalNoturnoMin,
    horasNoturnas: minToTime(minNoturnos),
    adicionalNoturno: minToTime(adicionalNoturnoMin),
    intervaloMin,
    intervaloInsuficiente,
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
  const chaveCache = `${colaborador.id}:${ano}-${mes}`;
  const emCache = cacheMes.get(chaveCache);
  if (emCache && emCache.expiraEm > Date.now()) {
    return emCache.resultado;
  }

  const nd = daysInMonth(ano, mes);
  const inicio = dateStr(ano, mes, 1);
  const fim = dateStr(ano, mes, nd);
  const agora = new Date();
  const hoje = dateStr(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());

  const [batidas, abonos, feriados, ferias, atestados, ocorrencias, jornadaVersoes] = await Promise.all([
    Batida.findAll({ where: { colaboradorId: colaborador.id, data: { [Op.between]: [inicio, fim] } } }),
    Abono.findAll({ where: { colaboradorId: colaborador.id, status: 'aprovado', data: { [Op.between]: [inicio, fim] } } }),
    Feriado.findAll({ where: { data: { [Op.between]: [inicio, fim] } } }),
    Ferias.findAll({ where: { colaboradorId: colaborador.id } }),
    Atestado.findAll({ where: { colaboradorId: colaborador.id } }),
    Ocorrencia.findAll({ where: { colaboradorId: colaborador.id } }),
    JornadaVersao.findAll({ where: { colaboradorId: colaborador.id } }),
  ]);

  const context = {
    batidasPorData: Object.fromEntries(batidas.map((b) => [b.data, b])),
    abonosAprovados: new Set(abonos.map((a) => a.data)),
    feriados: new Set(feriados.map((f) => f.data)),
    ferias: ferias.map((f) => f.get({ plain: true })),
    atestados: atestados.map((a) => a.get({ plain: true })),
    ocorrencias: ocorrencias.map((o) => o.get({ plain: true })),
    jornadaVersoes,
    hoje,
  };

  const dias = [];
  let totalTrabalhado = 0;
  let totalAtraso = 0;
  let totalExtra = 0;
  let totalFaltas = 0;
  let totalNoturno = 0;
  let totalAdicionalNoturno = 0;
  let diasIntervaloInsuficiente = 0;
  let diasComAtraso = 0;

  for (let d = 1; d <= nd; d += 1) {
    // eslint-disable-next-line no-await-in-loop
    const dia = await calcularDia(colaborador, ano, mes, d, context);
    dias.push(dia);
    totalTrabalhado += dia.minutosTrabalhados;
    totalAtraso += dia.minutosAtraso;
    totalExtra += dia.minutosExtra;
    totalNoturno += dia.minutosNoturnos;
    totalAdicionalNoturno += dia.adicionalNoturnoMin;
    if (dia.falta) totalFaltas += 1;
    if (dia.intervaloInsuficiente) diasIntervaloInsuficiente += 1;
    if (dia.diaComAtraso) diasComAtraso += 1;
  }

  const resultado = {
    dias,
    totais: {
      trabalhado: minToTime(totalTrabalhado),
      atraso: minToTime(totalAtraso),
      extra: minToTime(totalExtra),
      faltas: totalFaltas,
      diasComAtraso,
      noturno: minToTime(totalNoturno),
      adicionalNoturno: minToTime(totalAdicionalNoturno),
      diasIntervaloInsuficiente,
    },
  };
  cacheMes.set(chaveCache, { resultado, expiraEm: Date.now() + TTL_CACHE_MES_MS });
  return resultado;
}

module.exports = {
  calcularMes, calcularDia, minToTime, timeToMin, daysInMonth, dateStr,
  buscarJornadaVigente, minutosNoturnos, jornadaPrevistaMin, previstaMinParaData,
  invalidarCacheColaborador, invalidarCacheMes,
};
