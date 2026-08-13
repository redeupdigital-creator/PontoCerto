'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('nr1_acoes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      titulo: { type: Sequelize.STRING, allowNull: false },
      descricao: { type: Sequelize.TEXT, allowNull: true },
      tipo: { type: Sequelize.STRING, allowNull: false, defaultValue: 'treinamento' }, // treinamento | palestra | ginastica_laboral | avaliacao_risco | outro
      dataRealizacao: { type: Sequelize.DATEONLY, allowNull: false },
      cargaHorariaMin: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      geraAbono: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      anexoPath: { type: Sequelize.STRING, allowNull: true }, // lista de presença, certificado, material
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('nr1_participacoes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      acaoId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'nr1_acoes', key: 'id' }, onDelete: 'CASCADE',
      },
      colaboradorId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'colaboradores', key: 'id' }, onDelete: 'CASCADE',
      },
      presente: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      horasAbonadas: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      abonoId: { type: Sequelize.UUID, allowNull: true }, // referência ao Abono gerado automaticamente, se houver
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('nr1_participacoes', ['acaoId', 'colaboradorId'], { unique: true });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('nr1_participacoes');
    await queryInterface.dropTable('nr1_acoes');
  },
};
