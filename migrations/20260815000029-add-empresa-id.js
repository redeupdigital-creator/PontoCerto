'use strict';

// Colaborador e Usuario são os dois pontos de entrada do isolamento
// multi-empresa — tudo que pertence a um colaborador (batida, abono,
// ausência, holerite etc.) já fica isolado indiretamente através dele.
// Feriados, ações de NR-1, notificações e auditoria não têm um colaborador
// "dono" fixo (podem ser amplos), então precisam de empresaId direto.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tabelas = ['colaboradores', 'usuarios', 'feriados', 'nr1_acoes', 'auditoria', 'notificacoes'];
    for (const tabela of tabelas) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn(tabela, 'empresaId', {
        type: Sequelize.UUID,
        allowNull: true, // true por ora — preenchido no backfill abaixo, depois travado pela aplicação
        references: { model: 'empresas', key: 'id' },
      });
    }

    // Backfill: todo dado que já existia pertence à primeira empresa
    // (criada na migration anterior) — ninguém perde acesso ao próprio dado
    // com a mudança para multi-empresa.
    const [primeiraEmpresa] = await queryInterface.sequelize.query('SELECT id FROM empresas ORDER BY "createdAt" ASC LIMIT 1');
    const empresaId = primeiraEmpresa && primeiraEmpresa[0] && primeiraEmpresa[0].id;
    if (empresaId) {
      for (const tabela of tabelas) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.sequelize.query(
          `UPDATE ${tabela} SET "empresaId" = :empresaId WHERE "empresaId" IS NULL`,
          { replacements: { empresaId } }
        );
      }
    }
  },
  down: async (queryInterface) => {
    const tabelas = ['colaboradores', 'usuarios', 'feriados', 'nr1_acoes', 'auditoria', 'notificacoes'];
    for (const tabela of tabelas) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn(tabela, 'empresaId');
    }
  },
};
