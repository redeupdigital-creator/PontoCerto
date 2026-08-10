const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Abono = sequelize.define('Abono', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  data: { type: DataTypes.DATEONLY, allowNull: false },
  tipoMotivo: {
    type: DataTypes.ENUM('esquecimento', 'liberado_gerencia', 'trabalho_externo', 'outro'),
    allowNull: false,
  },
  horarioInformado: DataTypes.STRING,
  justificativa: DataTypes.TEXT,
  solicitadoPor: DataTypes.STRING,
  aprovadorId: DataTypes.UUID,
  status: { type: DataTypes.ENUM('pendente', 'aprovado', 'reprovado'), defaultValue: 'pendente' },
  dataDecisao: DataTypes.DATE,
}, {
  tableName: 'abonos',
});

module.exports = Abono;
