'use strict';

// Colaborador.status já existia ('ativo'|'inativo'). Aqui: campos de contexto
// do desligamento atual no cadastro (consulta rápida), e uma tabela de
// HISTÓRICO separada — porque a mesma pessoa pode ser desligada e
// recontratada mais de uma vez, e cada ciclo precisa ficar registrado, não
// só o último.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('colaboradores', 'tipoDesligamento', {
      type: Sequelize.STRING, allowNull: true, // 'pedido_demissao' | 'dispensa_sem_justa_causa' | 'dispensa_com_justa_causa' | 'termino_contrato' | 'outro'
    });
    await queryInterface.addColumn('colaboradores', 'motivoDesligamento', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'anexoDesligamentoPath', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.createTable('colaborador_desligamentos', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      colaboradorId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'colaboradores', key: 'id' }, onDelete: 'CASCADE',
      },
      dataAdmissaoDoCiclo: { type: Sequelize.DATEONLY, allowNull: true }, // quando esse período de trabalho começou
      dataDesligamento: { type: Sequelize.DATEONLY, allowNull: false },
      tipo: { type: Sequelize.STRING, allowNull: false },
      motivo: { type: Sequelize.TEXT, allowNull: true },
      anexoPath: { type: Sequelize.STRING, allowNull: true }, // termo de rescisão, aviso prévio etc.
      registradoPor: { type: Sequelize.STRING, allowNull: true }, // login de quem registrou
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('colaborador_desligamentos', ['colaboradorId']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('colaborador_desligamentos');
    await queryInterface.removeColumn('colaboradores', 'tipoDesligamento');
    await queryInterface.removeColumn('colaboradores', 'motivoDesligamento');
    await queryInterface.removeColumn('colaboradores', 'anexoDesligamentoPath');
  },
};
