'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('jornada_versoes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'CASCADE',
      },
      jornada: { type: Sequelize.TEXT, allowNull: false },
      vigenciaInicio: { type: Sequelize.DATEONLY, allowNull: false },
      vigenciaFim: { type: Sequelize.DATEONLY, allowNull: true }, // null = versão vigente
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('jornada_versoes', ['colaboradorId', 'vigenciaInicio']);

    // Backfill: cada colaborador já cadastrado ganha uma versão inicial com a
    // jornada atual, vigente desde a admissão (ou uma data bem antiga, se a
    // admissão não estiver preenchida) até hoje (sem fim = vigente).
    const [colaboradores] = await queryInterface.sequelize.query(
      `SELECT id, jornada, "dataAdmissao" FROM colaboradores`
    );
    const agora = new Date();
    const crypto = require('crypto');
    for (const c of colaboradores) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.bulkInsert('jornada_versoes', [{
        id: crypto.randomUUID(),
        colaboradorId: c.id,
        jornada: c.jornada || '{}',
        vigenciaInicio: c.dataAdmissao || '2000-01-01',
        vigenciaFim: null,
        createdAt: agora,
        updatedAt: agora,
      }]);
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('jornada_versoes');
  },
};
