'use strict';

// Antes do multi-empresa, `login` era único globalmente. Agora cada empresa
// tem seu próprio espaço de logins — "admin" pode existir em Codismolas E
// em AutoMolas, são usuários diferentes. Troca a constraint única de
// `login` sozinho para `(empresaId, login)` juntos.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Nota: não uso changeColumn(allowNull:false) para empresaId (o
    // SQLite reconstrói a tabela inteira, quebrando as várias FKs que
    // apontam para `colaboradores`) — mas `usuarios` e `feriados` não têm
    // NENHUMA foreign key apontando para dentro delas, então é seguro usar
    // changeColumn aqui pra remover a coluna `login`/`data` do estado
    // "UNIQUE embutido" (é assim que o SQLite grava `unique:true`, e não
    // dá pra tirar isso com removeIndex — testei, falha silenciosamente).
    await queryInterface.changeColumn('usuarios', 'login', { type: Sequelize.STRING, allowNull: false, unique: false });
    await queryInterface.addIndex('usuarios', ['empresaId', 'login'], { unique: true, name: 'usuarios_empresa_login_unique' });

    await queryInterface.changeColumn('feriados', 'data', { type: Sequelize.DATEONLY, allowNull: false, unique: false });
    await queryInterface.addIndex('feriados', ['empresaId', 'data'], { unique: true, name: 'feriados_empresa_data_unique' });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('usuarios', 'usuarios_empresa_login_unique').catch(() => {});
    await queryInterface.changeColumn('usuarios', 'login', { type: Sequelize.STRING, allowNull: false, unique: true });
    await queryInterface.removeIndex('feriados', 'feriados_empresa_data_unique').catch(() => {});
    await queryInterface.changeColumn('feriados', 'data', { type: Sequelize.DATEONLY, allowNull: false, unique: true });
  },
};
