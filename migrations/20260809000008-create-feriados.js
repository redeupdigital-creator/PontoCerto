'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('feriados', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      data: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
      descricao: Sequelize.STRING,
      abrangencia: { type: Sequelize.STRING, defaultValue: 'nacional' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('feriados');
  },
};
