'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('colaboradores', 'gestorId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'colaboradores', key: 'id' },
      onDelete: 'SET NULL',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('colaboradores', 'gestorId');
  },
};
