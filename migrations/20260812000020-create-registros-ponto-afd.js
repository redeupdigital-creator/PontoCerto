'use strict';

// Tabela de INSERÇÃO APENAS (nunca update/delete pela aplicação): cada
// marcação individual de ponto vira uma linha aqui, numerada sequencialmente
// (NSR) e encadeada por hash SHA-256, exatamente como a Portaria 671/2021
// exige para o Arquivo Fonte de Dados (AFD). A tabela `batidas` continua
// existindo separadamente como resumo editável do dia (para cálculo/relatório
// rápido) — esta aqui é a trilha fiscal que nunca é alterada.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('registros_ponto_afd', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nsr: { type: Sequelize.INTEGER, allowNull: false, unique: true }, // Número Sequencial de Registro
      colaboradorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onDelete: 'RESTRICT', // nunca deixar apagar colaborador e perder a marcação fiscal
      },
      dataHoraMarcacao: { type: Sequelize.DATE, allowNull: false }, // hora que o colaborador bateu o ponto
      dataHoraGravacao: { type: Sequelize.DATE, allowNull: false }, // hora que o sistema gravou (normalmente igual)
      idColetor: { type: Sequelize.STRING(2), allowNull: false }, // "01" app mobile, "02" browser, "03" desktop, "04"/"05" dispositivo
      online: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      hashAnterior: { type: Sequelize.STRING, allowNull: true }, // hash do registro imediatamente anterior (cadeia)
      hashAtual: { type: Sequelize.STRING, allowNull: false }, // SHA-256 deste registro
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('registros_ponto_afd', ['nsr']);
    await queryInterface.addIndex('registros_ponto_afd', ['colaboradorId', 'dataHoraMarcacao']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('registros_ponto_afd');
  },
};
