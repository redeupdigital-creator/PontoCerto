const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Atestado = sequelize.define('Atestado', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  dataInicio: { type: DataTypes.DATEONLY, allowNull: false },
  dataFim: { type: DataTypes.DATEONLY, allowNull: false },
  cid: DataTypes.STRING,
  medico: DataTypes.STRING,
  anexoPath: DataTypes.STRING,
}, {
  tableName: 'atestados',
});

module.exports = Atestado;
