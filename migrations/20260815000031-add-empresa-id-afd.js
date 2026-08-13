'use strict';

// O NSR (Número Sequencial de Registro) do AFD precisa ser sequencial POR
// EMPRESA — cada uma tem seu próprio arquivo fiscal perante a Portaria
// 671/2021, não faz sentido a numeração ficar compartilhada entre
// Codismolas, AutoMolas e Nordeste. Adiciona empresaId direto (em vez de só
// via colaboradorId) para essa consulta ficar simples e rápida.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('registros_ponto_afd', 'empresaId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'empresas', key: 'id' },
    });
    // Backfill via colaborador (todo registro já tem um colaboradorId, e todo
    // colaborador já tem empresaId nesse ponto da cadeia de migrations).
    await queryInterface.sequelize.query(`
      UPDATE registros_ponto_afd
      SET "empresaId" = (SELECT "empresaId" FROM colaboradores WHERE colaboradores.id = registros_ponto_afd."colaboradorId")
      WHERE "empresaId" IS NULL
    `);

    // NSR também não pode ser único globalmente — cada empresa tem sua
    // própria numeração sequencial (NSR=1 existe em Codismolas E em
    // AutoMolas, são arquivos AFD diferentes). Sem FK entrando nesta
    // tabela, é seguro usar changeColumn.
    await queryInterface.changeColumn('registros_ponto_afd', 'nsr', { type: Sequelize.INTEGER, allowNull: false, unique: false });
    await queryInterface.addIndex('registros_ponto_afd', ['empresaId', 'nsr'], { unique: true, name: 'afd_empresa_nsr_unique' });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('registros_ponto_afd', 'afd_empresa_nsr_unique').catch(() => {});
    await queryInterface.changeColumn('registros_ponto_afd', 'nsr', { type: Sequelize.INTEGER, allowNull: false, unique: true });
    await queryInterface.removeColumn('registros_ponto_afd', 'empresaId');
  },
};
