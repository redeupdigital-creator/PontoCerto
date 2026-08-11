'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('auditoria', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      usuarioId: { type: Sequelize.UUID, allowNull: true },
      usuarioLogin: { type: Sequelize.STRING, allowNull: true }, // denormalizado: sobrevive mesmo se o usuário for removido depois
      perfil: { type: Sequelize.STRING, allowNull: true },
      acao: { type: Sequelize.STRING, allowNull: false }, // create | update | delete | aprovar | reprovar | reset_senha | login
      entidade: { type: Sequelize.STRING, allowNull: false }, // Colaborador | Usuario | Batida | Abono | Ferias | Atestado | Ocorrencia | Empresa | Feriado
      entidadeId: { type: Sequelize.UUID, allowNull: true },
      detalhes: { type: Sequelize.TEXT, allowNull: true }, // JSON com o resumo do que mudou
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('auditoria', ['entidade', 'entidadeId']);
    await queryInterface.addIndex('auditoria', ['createdAt']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('auditoria');
  },
};
