'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('abonos', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      data: { type: Sequelize.DATEONLY, allowNull: false },
      tipoMotivo: {
        type: Sequelize.ENUM('esquecimento', 'liberado_gerencia', 'trabalho_externo', 'outro'),
        allowNull: false,
      },
      horarioInformado: Sequelize.STRING,
      justificativa: Sequelize.TEXT,
      solicitadoPor: Sequelize.STRING,
      aprovadorId: Sequelize.UUID,
      status: { type: Sequelize.ENUM('pendente', 'aprovado', 'reprovado'), defaultValue: 'pendente' },
      dataDecisao: Sequelize.DATE,
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('abonos');
  },
};
