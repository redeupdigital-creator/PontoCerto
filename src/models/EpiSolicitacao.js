const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EpiSolicitacao = sequelize.define('EpiSolicitacao', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  item: { type: DataTypes.STRING, allowNull: false },
  quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  motivo: DataTypes.STRING,
  dataSolicitacao: { type: DataTypes.DATEONLY, allowNull: false },
  dataEntrega: DataTypes.DATEONLY,
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pendente' },
  observacao: DataTypes.TEXT,
  anexoPath: DataTypes.STRING,
}, {
  tableName: 'epi_solicitacoes',
});

module.exports = EpiSolicitacao;
