'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('colaboradores', 'horaEntradaPadrao', {
      type: Sequelize.STRING(5), // "HH:MM"
      allowNull: true,
      defaultValue: '08:00',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('colaboradores', 'horaEntradaPadrao');
  },
};
