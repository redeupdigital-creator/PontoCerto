const { Op } = require('sequelize');
const { Notificacao, Colaborador, Empresa } = require('../models');
const { montarPainelAoVivo } = require('./dashboardAoVivo');
const { notificar } = require('./notificacoes');

const TIPO_NOTIFICACAO = 'atraso_detectado';

/**
 * Roda o Painel ao Vivo de TODAS as empresas ativas e notifica (uma vez por
 * dia, por colaborador) quem está com status "atrasado" agora. Pensado para
 * ser chamado periodicamente — por um `setInterval` em hospedagem
 * tradicional (src/server.js) ou por um Cron Job em ambiente serverless
 * (ver vercel.json e a rota protegida por CRON_SECRET em src/routes/dashboard.js).
 *
 * Deduplicação: antes de notificar, confere se já existe uma notificação
 * deste tipo para o colaborador HOJE — evita mandar o mesmo alerta a cada
 * execução do monitor (ex.: a cada 15 minutos).
 */
async function verificarEnotificarAtrasos() {
  const empresas = await Empresa.findAll({ where: { ativa: true } });
  let totalVerificados = 0;
  let totalNotificados = 0;

  for (const empresa of empresas) {
    // eslint-disable-next-line no-await-in-loop
    const painel = await montarPainelAoVivo(empresa.id);
    const atrasados = painel.colaboradores.filter((c) => c.status === 'atrasado');
    const inicioDoDia = new Date(`${painel.hoje}T00:00:00`);
    totalVerificados += atrasados.length;

    for (const c of atrasados) {
      // eslint-disable-next-line no-await-in-loop
      const jaNotificadoHoje = await Notificacao.findOne({
        where: { colaboradorId: c.colaboradorId, tipo: TIPO_NOTIFICACAO, createdAt: { [Op.gte]: inicioDoDia } },
      });
      if (jaNotificadoHoje) continue;

      // eslint-disable-next-line no-await-in-loop
      const colaborador = await Colaborador.findByPk(c.colaboradorId);
      // eslint-disable-next-line no-await-in-loop
      await notificar({
        empresaId: empresa.id,
        // Usa o colaboradorId real (não null) — assim a notificação aparece
        // tanto para coordenador/admin (que veem tudo, sem filtro) quanto,
        // soa razoável, para o próprio colaborador, e principalmente permite
        // a deduplicação acima encontrar o registro de hoje corretamente.
        colaboradorId: c.colaboradorId,
        tipo: TIPO_NOTIFICACAO,
        titulo: 'Colaborador em atraso',
        mensagem: `${c.nome} ainda não bateu o ponto hoje e já passou do horário + tolerância (entrada esperada: ${colaborador?.horaEntradaPadrao || '—'}).`,
        emailDestino: process.env.NOTIFICACAO_GESTOR_EMAIL || null,
      });
      totalNotificados += 1;
    }
  }

  return { verificados: totalVerificados, notificados: totalNotificados, empresas: empresas.length };
}

module.exports = { verificarEnotificarAtrasos, TIPO_NOTIFICACAO };
