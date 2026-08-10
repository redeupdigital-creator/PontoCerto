'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notificacoes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // null = notificação "ampla" destinada a RH/gestores, não a um colaborador específico
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      tipo: { type: Sequelize.STRING, allowNull: false }, // abono_pendente | abono_aprovado | abono_reprovado
      titulo: { type: Sequelize.STRING, allowNull: false },
      mensagem: { type: Sequelize.TEXT, allowNull: false },
      canal: { type: Sequelize.STRING, defaultValue: 'sistema' }, // sistema | email
      emailEnviado: { type: Sequelize.BOOLEAN, defaultValue: false },
      lida: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('notificacoes');
  },
};
