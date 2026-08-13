'use strict';

// Estrutura padrão de mercado (salário + dados bancários + PIX + holerite
// mensal anexável). O usuário mencionou um arquivo de referência que não
// chegou a ser anexado — se os campos reais forem diferentes, é uma
// migration adicional simples de ajustar depois.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('colaboradores', 'salarioBase', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
    await queryInterface.addColumn('colaboradores', 'tipoContrato', { type: Sequelize.STRING, allowNull: true, defaultValue: 'clt' }); // clt | pj | estagio | temporario | aprendiz
    await queryInterface.addColumn('colaboradores', 'banco', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'agencia', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'conta', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'tipoConta', { type: Sequelize.STRING, allowNull: true }); // corrente | poupanca
    await queryInterface.addColumn('colaboradores', 'chavePix', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.createTable('holerites', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'colaboradores', key: 'id' }, onDelete: 'CASCADE',
      },
      competencia: { type: Sequelize.STRING(7), allowNull: false }, // "YYYY-MM"
      valorBruto: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      valorLiquido: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      descontosTexto: { type: Sequelize.TEXT, allowNull: true }, // resumo livre (INSS, IRRF, VT, VR etc.)
      dataPagamento: { type: Sequelize.DATEONLY, allowNull: true },
      anexoPath: { type: Sequelize.STRING, allowNull: true }, // holerite em PDF
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('holerites', ['colaboradorId', 'competencia'], { unique: true });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('holerites');
    await queryInterface.removeColumn('colaboradores', 'salarioBase');
    await queryInterface.removeColumn('colaboradores', 'tipoContrato');
    await queryInterface.removeColumn('colaboradores', 'banco');
    await queryInterface.removeColumn('colaboradores', 'agencia');
    await queryInterface.removeColumn('colaboradores', 'conta');
    await queryInterface.removeColumn('colaboradores', 'tipoConta');
    await queryInterface.removeColumn('colaboradores', 'chavePix');
  },
};
