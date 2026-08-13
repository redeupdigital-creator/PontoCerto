'use strict';

// Hoje a jornada só sabe representar "N horas por dia da semana" (jornada
// semanal fixa). Isso não cobre escalas cíclicas comuns no Brasil (12x36,
// 6x1, plantões), que não seguem o dia da semana — seguem uma contagem de
// dias desde uma data de referência. Esta migration adiciona os campos
// necessários para representar isso, mantendo "semanal" como padrão
// retrocompatível (nada muda para quem já usa jornada semanal).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('jornada_versoes', 'tipoEscala', {
      type: Sequelize.STRING, allowNull: false, defaultValue: 'semanal', // 'semanal' | 'ciclica'
    });
    await queryInterface.addColumn('jornada_versoes', 'ciclo', {
      type: Sequelize.TEXT, allowNull: true, // JSON: array de horas por dia do ciclo, ex. [12,0] para 12x36
    });
    await queryInterface.addColumn('jornada_versoes', 'dataReferenciaCiclo', {
      type: Sequelize.DATEONLY, allowNull: true, // data que corresponde à posição 0 do array `ciclo`
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('jornada_versoes', 'tipoEscala');
    await queryInterface.removeColumn('jornada_versoes', 'ciclo');
    await queryInterface.removeColumn('jornada_versoes', 'dataReferenciaCiclo');
  },
};
