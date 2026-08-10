'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ocorrencias', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      tipo: { type: Sequelize.ENUM('advertencia', 'suspensao'), allowNull: false },
      dataInicio: { type: Sequelize.DATEONLY, allowNull: false },
      dataFim: Sequelize.DATEONLY,
      motivo: Sequelize.TEXT,
      aplicadoPor: Sequelize.STRING,
      anexoPath: Sequelize.STRING,
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ocorrencias');
  },
};
