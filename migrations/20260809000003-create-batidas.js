'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('batidas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      data: { type: Sequelize.DATEONLY, allowNull: false },
      e1: Sequelize.STRING,
      s1: Sequelize.STRING,
      e2: Sequelize.STRING,
      s2: Sequelize.STRING,
      origem: { type: Sequelize.STRING, defaultValue: 'manual' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('batidas', ['colaboradorId', 'data'], {
      unique: true,
      name: 'batidas_colaborador_data_unique',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('batidas');
  },
};
