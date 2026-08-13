const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Nr1Acao = sequelize.define('Nr1Acao', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresaId: { type: DataTypes.UUID, allowNull: false },
  titulo: { type: DataTypes.STRING, allowNull: false },
  descricao: DataTypes.TEXT,
  tipo: { type: DataTypes.STRING, allowNull: false, defaultValue: 'treinamento' },
  dataRealizacao: { type: DataTypes.DATEONLY, allowNull: false },
  cargaHorariaMin: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  geraAbono: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  anexoPath: DataTypes.STRING,
}, {
  tableName: 'nr1_acoes',
});

module.exports = Nr1Acao;
