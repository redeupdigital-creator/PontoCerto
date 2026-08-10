'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('colaboradores', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nome: { type: Sequelize.STRING, allowNull: false },
      matricula: Sequelize.STRING,
      cargo: Sequelize.STRING,
      departamento: Sequelize.STRING,
      dataAdmissao: Sequelize.DATEONLY,
      dataDemissao: Sequelize.DATEONLY,
      status: { type: Sequelize.STRING, defaultValue: 'ativo' },
      fotoPath: Sequelize.STRING,
      jornada: { type: Sequelize.TEXT },
      toleranciaMin: { type: Sequelize.INTEGER, defaultValue: 5 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('colaboradores');
  },
};
