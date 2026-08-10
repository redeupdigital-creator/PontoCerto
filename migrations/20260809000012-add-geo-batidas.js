'use strict';

const SLOTS = ['e1', 's1', 'e2', 's2'];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const slot of SLOTS) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn('batidas', `${slot}Lat`, { type: Sequelize.FLOAT, allowNull: true });
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn('batidas', `${slot}Lng`, { type: Sequelize.FLOAT, allowNull: true });
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn('batidas', `${slot}Precisao`, { type: Sequelize.FLOAT, allowNull: true });
    }
  },
  down: async (queryInterface) => {
    for (const slot of SLOTS) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn('batidas', `${slot}Lat`);
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn('batidas', `${slot}Lng`);
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn('batidas', `${slot}Precisao`);
    }
  },
};
