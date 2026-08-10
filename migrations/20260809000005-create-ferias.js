'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ferias', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      periodoAquisitivoInicio: Sequelize.DATEONLY,
      periodoAquisitivoFim: Sequelize.DATEONLY,
      dataInicioGozo: { type: Sequelize.DATEONLY, allowNull: false },
      dataFimGozo: { type: Sequelize.DATEONLY, allowNull: false },
      diasAbonoPecuniario: { type: Sequelize.INTEGER, defaultValue: 0 },
      status: { type: Sequelize.STRING, defaultValue: 'programada' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ferias');
  },
};
