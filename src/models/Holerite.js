const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Holerite = sequelize.define('Holerite', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  competencia: { type: DataTypes.STRING(7), allowNull: false }, // "YYYY-MM"
  valorBruto: DataTypes.DECIMAL(10, 2),
  valorLiquido: DataTypes.DECIMAL(10, 2),
  descontosTexto: DataTypes.TEXT,
  dataPagamento: DataTypes.DATEONLY,
  anexoPath: DataTypes.STRING,
}, {
  tableName: 'holerites',
});

module.exports = Holerite;
