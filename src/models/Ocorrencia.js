const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Ocorrencia = sequelize.define('Ocorrencia', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  tipo: { type: DataTypes.ENUM('advertencia', 'suspensao'), allowNull: false },
  dataInicio: { type: DataTypes.DATEONLY, allowNull: false },
  dataFim: DataTypes.DATEONLY, // usado em suspensão
  motivo: DataTypes.TEXT,
  aplicadoPor: DataTypes.STRING,
  anexoPath: DataTypes.STRING,
}, {
  tableName: 'ocorrencias',
});

module.exports = Ocorrencia;
