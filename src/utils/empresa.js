const { Colaborador } = require('../models');

/**
 * Confere que o colaborador informado pertence à mesma empresa do usuário
 * logado — usado em toda rota que opera sobre um colaboradorId específico
 * (batidas, abonos, ausências, EPI, holerites...), já que essas tabelas não
 * têm empresaId direto: o isolamento vem através do colaborador.
 *
 * Retorna o colaborador (já carregado, evita buscar de novo) se pertencer à
 * empresa, ou `null` se não existir ou for de outra empresa — quem chama
 * decide se isso vira 404 ou 403 (via de regra, 404: não revelar que o
 * registro existe em outra empresa).
 */
async function colaboradorDaEmpresa(colaboradorId, empresaId) {
  if (!colaboradorId) return null;
  const colaborador = await Colaborador.findOne({ where: { id: colaboradorId, empresaId } });
  return colaborador;
}

/**
 * Lista de IDs de colaboradores de uma empresa — usada em relatórios/
 * agregações que não partem de um colaboradorId específico (ex: "todas as
 * férias registradas este mês"), pra filtrar `where: { colaboradorId: { [Op.in]: ids } }`.
 */
async function idsColaboradoresDaEmpresa(empresaId) {
  const colaboradores = await Colaborador.findAll({ where: { empresaId }, attributes: ['id'] });
  return colaboradores.map((c) => c.id);
}

module.exports = { colaboradorDaEmpresa, idsColaboradoresDaEmpresa };
