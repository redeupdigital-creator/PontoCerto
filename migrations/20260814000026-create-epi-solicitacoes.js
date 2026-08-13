'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('epi_solicitacoes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'colaboradores', key: 'id' }, onDelete: 'CASCADE',
      },
      item: { type: Sequelize.STRING, allowNull: false }, // ex: "Capacete", "Luva de proteção"
      quantidade: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      motivo: { type: Sequelize.STRING, allowNull: true }, // 'primeira_entrega' | 'reposicao' | 'danificado' | 'outro'
      dataSolicitacao: { type: Sequelize.DATEONLY, allowNull: false },
      dataEntrega: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pendente' }, // pendente | entregue | cancelado
      observacao: { type: Sequelize.TEXT, allowNull: true },
      anexoPath: { type: Sequelize.STRING, allowNull: true }, // comprovante/ficha de entrega assinada
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('epi_solicitacoes', ['colaboradorId']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('epi_solicitacoes');
  },
};
