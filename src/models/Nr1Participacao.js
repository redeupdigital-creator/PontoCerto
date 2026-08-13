const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Nr1Participacao = sequelize.define('Nr1Participacao', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  acaoId: { type: DataTypes.UUID, allowNull: false },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  presente: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  horasAbonadas: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  abonoId: DataTypes.UUID,
}, {
  tableName: 'nr1_participacoes',
});

module.exports = Nr1Participacao;
