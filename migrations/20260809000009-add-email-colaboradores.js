'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('colaboradores', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('colaboradores', 'email');
  },
};
