'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('usuarios', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'SET NULL',
      },
      login: { type: Sequelize.STRING, allowNull: false, unique: true },
      senhaHash: { type: Sequelize.STRING, allowNull: false },
      perfil: {
        type: Sequelize.ENUM('colaborador', 'gestor', 'rh', 'admin'),
        defaultValue: 'colaborador',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('usuarios');
  },
};
