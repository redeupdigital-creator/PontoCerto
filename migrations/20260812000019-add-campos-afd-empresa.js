'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('empresa_config', 'cpfResponsavelRegistros', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('empresa_config', 'numeroRegistroInpiRepP', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('empresa_config', 'localPrestacaoServico', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('empresa_config', 'cpfResponsavelRegistros');
    await queryInterface.removeColumn('empresa_config', 'numeroRegistroInpiRepP');
    await queryInterface.removeColumn('empresa_config', 'localPrestacaoServico');
  },
};
