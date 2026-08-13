'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ferias ainda não tinha campo de anexo (Atestado e Ocorrencia já tinham
    // no model, mas nenhum dos três tinha upload de verdade conectado).
    await queryInterface.addColumn('ferias', 'anexoPath', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('ferias', 'anexoPath');
  },
};
