const { Op } = require('sequelize');
const {
  Colaborador, Batida, Feriado, Ferias, Atestado, Ocorrencia, Abono, JornadaVersao,
} = require('../models');
const { timeToMin, minToTime, buscarJornadaVigente, jornadaPrevistaMin, calcularMes } = require('./calculo');

function dataAtualStr(agora) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

/**
 * Determina o status "agora" de um colaborador, a partir da batida de hoje,
 * da jornada vigente, de ausências (férias/atestado/suspensão) e de abono.
 * Não depende de "atraso em minutos totais" (que só faz sentido ao final do
 * dia) — compara o relógio atual com o horário de entrada esperado.
 */
function statusAoVivo({ colaborador, batidaHoje, jornadaHoje, dow, ausenciaHoje, abonadoHoje, feriadoHoje, agora }) {
  if (ausenciaHoje) return { status: 'ausencia', detalhe: ausenciaHoje.tipo };

  const prevista = feriadoHoje ? 0 : jornadaPrevistaMin(jornadaHoje, dow);
  if (prevista === 0) return { status: 'folga' };

  if (abonadoHoje) return { status: 'abonado' };

  const e1 = timeToMin(batidaHoje?.e1);
  const s1 = timeToMin(batidaHoje?.s1);
  const e2 = timeToMin(batidaHoje?.e2);
  const s2 = timeToMin(batidaHoje?.s2);

  if (s2 !== null) return { status: 'concluido', ultimaBatida: minToTime(s2) };
  if (e2 !== null) return { status: 'presente', entrada: batidaHoje.e1 };
  if (s1 !== null) return { status: 'intervalo', entrada: batidaHoje.e1 };

  const horaAtualMin = agora.getHours() * 60 + agora.getMinutes();
  const entradaEsperadaMin = timeToMin(colaborador.horaEntradaPadrao) ?? 8 * 60;
  const tolerancia = Number(colaborador.toleranciaMin) || 0;
  const limiteSemAtraso = entradaEsperadaMin + tolerancia;

  if (e1 !== null) {
    return e1 > limiteSemAtraso
      ? { status: 'presente_atrasado', entrada: batidaHoje.e1 }
      : { status: 'presente', entrada: batidaHoje.e1 };
  }

  // Ainda não bateu nenhuma batida hoje
  if (horaAtualMin < limiteSemAtraso) return { status: 'nao_iniciado' };
  return { status: 'atrasado' };
}

/**
 * Monta o painel ao vivo: status de agora + faltas/atrasos do mês corrente
 * para cada colaborador ativo.
 */
async function montarPainelAoVivo() {
  const agora = new Date();
  const hoje = dataAtualStr(agora);
  const dow = agora.getDay();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const colaboradores = await Colaborador.findAll({ where: { status: 'ativo' }, order: [['nome', 'ASC']] });

  const [batidasHoje, feriadosHoje, feriasAtivas, atestadosAtivos, suspensoesAtivas, abonosHoje] = await Promise.all([
    Batida.findAll({ where: { data: hoje } }),
    Feriado.findAll({ where: { data: hoje } }),
    Ferias.findAll({ where: { dataInicioGozo: { [Op.lte]: hoje }, dataFimGozo: { [Op.gte]: hoje } } }),
    Atestado.findAll({ where: { dataInicio: { [Op.lte]: hoje }, dataFim: { [Op.gte]: hoje } } }),
    Ocorrencia.findAll({ where: { tipo: 'suspensao', dataInicio: { [Op.lte]: hoje } } }),
    Abono.findAll({ where: { data: hoje, status: 'aprovado' } }),
  ]);

  const feriadoHoje = feriadosHoje.length > 0;
  const batidaPorColaborador = Object.fromEntries(batidasHoje.map((b) => [b.colaboradorId, b]));
  const abonoPorColaborador = new Set(abonosHoje.map((a) => a.colaboradorId));
  const feriasPorColaborador = Object.fromEntries(feriasAtivas.map((f) => [f.colaboradorId, f]));
  const atestadoPorColaborador = Object.fromEntries(atestadosAtivos.map((a) => [a.colaboradorId, a]));
  const suspensaoPorColaborador = Object.fromEntries(
    suspensoesAtivas.filter((o) => !o.dataFim || o.dataFim >= hoje).map((o) => [o.colaboradorId, o])
  );

  const linhas = [];
  const contagem = { presente: 0, presente_atrasado: 0, intervalo: 0, atrasado: 0, nao_iniciado: 0, concluido: 0, ausencia: 0, abonado: 0, folga: 0 };

  for (const colaborador of colaboradores) {
    // eslint-disable-next-line no-await-in-loop
    const versoes = await JornadaVersao.findAll({ where: { colaboradorId: colaborador.id } });
    const jornadaHoje = buscarJornadaVigente(versoes, hoje, colaborador.jornada);

    let ausenciaHoje = null;
    if (suspensaoPorColaborador[colaborador.id]) ausenciaHoje = { tipo: 'suspensao' };
    else if (atestadoPorColaborador[colaborador.id]) ausenciaHoje = { tipo: 'atestado' };
    else if (feriasPorColaborador[colaborador.id]) ausenciaHoje = { tipo: 'ferias' };

    const resultado = statusAoVivo({
      colaborador,
      batidaHoje: batidaPorColaborador[colaborador.id],
      jornadaHoje,
      dow,
      ausenciaHoje,
      abonadoHoje: abonoPorColaborador.has(colaborador.id),
      feriadoHoje,
      agora,
    });

    contagem[resultado.status] = (contagem[resultado.status] || 0) + 1;

    // eslint-disable-next-line no-await-in-loop
    const { totais } = await calcularMes(colaborador, ano, mes);

    linhas.push({
      colaboradorId: colaborador.id,
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      cargo: colaborador.cargo,
      fotoPath: colaborador.fotoPath,
      ...resultado,
      faltasNoMes: totais.faltas,
      diasComAtrasoNoMes: totais.diasComAtraso,
    });
  }

  return { hoje, contagem, colaboradores: linhas };
}

module.exports = { montarPainelAoVivo, statusAoVivo };
