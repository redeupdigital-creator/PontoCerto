'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('colaboradores', 'numeroRegistro', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'ctps', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'localTrabalho', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('colaboradores', 'numeroRegistro');
    await queryInterface.removeColumn('colaboradores', 'ctps');
    await queryInterface.removeColumn('colaboradores', 'localTrabalho');
  },
};
