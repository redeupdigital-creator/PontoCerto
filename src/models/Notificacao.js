const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Notificacao = sequelize.define('Notificacao', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresaId: { type: DataTypes.UUID, allowNull: false },
  colaboradorId: DataTypes.UUID, // null = notificação para RH/gestores (não vinculada a um colaborador)
  tipo: { type: DataTypes.STRING, allowNull: false },
  titulo: { type: DataTypes.STRING, allowNull: false },
  mensagem: { type: DataTypes.TEXT, allowNull: false },
  canal: { type: DataTypes.STRING, defaultValue: 'sistema' },
  emailEnviado: { type: DataTypes.BOOLEAN, defaultValue: false },
  lida: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'notificacoes',
});

module.exports = Notificacao;
