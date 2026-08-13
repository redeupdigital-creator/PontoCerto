const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Feriado = sequelize.define('Feriado', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresaId: { type: DataTypes.UUID, allowNull: false },
  data: { type: DataTypes.DATEONLY, allowNull: false },
  descricao: DataTypes.STRING,
  abrangencia: { type: DataTypes.STRING, defaultValue: 'nacional' }, // nacional | estadual | municipal
}, {
  tableName: 'feriados',
});

module.exports = Feriado;
