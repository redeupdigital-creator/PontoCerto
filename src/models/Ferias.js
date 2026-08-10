const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Ferias = sequelize.define('Ferias', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  periodoAquisitivoInicio: DataTypes.DATEONLY,
  periodoAquisitivoFim: DataTypes.DATEONLY,
  dataInicioGozo: { type: DataTypes.DATEONLY, allowNull: false },
  dataFimGozo: { type: DataTypes.DATEONLY, allowNull: false },
  diasAbonoPecuniario: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'programada' }, // programada | em_curso | concluida
}, {
  tableName: 'ferias',
});

module.exports = Ferias;
