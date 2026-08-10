'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('atestados', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      dataInicio: { type: Sequelize.DATEONLY, allowNull: false },
      dataFim: { type: Sequelize.DATEONLY, allowNull: false },
      cid: Sequelize.STRING,
      medico: Sequelize.STRING,
      anexoPath: Sequelize.STRING,
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('atestados');
  },
};
