const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Auditoria = sequelize.define('Auditoria', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  usuarioId: DataTypes.UUID,
  usuarioLogin: DataTypes.STRING,
  perfil: DataTypes.STRING,
  acao: { type: DataTypes.STRING, allowNull: false },
  entidade: { type: DataTypes.STRING, allowNull: false },
  entidadeId: DataTypes.UUID,
  detalhes: DataTypes.TEXT,
}, {
  tableName: 'auditoria',
});

module.exports = Auditoria;
