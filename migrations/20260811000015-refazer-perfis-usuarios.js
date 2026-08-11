'use strict';

// Troca o campo "perfil" de ENUM fixo para STRING (mais portável entre
// sqlite/postgres/Supabase — evita a complexidade de ALTER TYPE do Postgres
// toda vez que a lista de perfis mudar). A validação da lista de perfis
// válidos passa a ser feita na camada de aplicação (src/routes/usuarios.js).
//
// Também migra dados existentes: os perfis antigos "gestor" e "rh" não têm
// equivalente 1:1 exato no novo modelo (que não é mais escopado por equipe),
// então ambos são migrados para "coordenador" — o mais próximo em termos de
// abrangência de acesso. Revise manualmente os usuários migrados depois.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('usuarios', 'perfil', {
      type: Sequelize.STRING,
      defaultValue: 'colaborador',
    });
    await queryInterface.sequelize.query(
      `UPDATE usuarios SET perfil = 'coordenador' WHERE perfil IN ('gestor', 'rh')`
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `UPDATE usuarios SET perfil = 'gestor' WHERE perfil = 'coordenador'`
    );
    await queryInterface.changeColumn('usuarios', 'perfil', {
      type: Sequelize.ENUM('colaborador', 'gestor', 'rh', 'admin'),
      defaultValue: 'colaborador',
    });
  },
};
