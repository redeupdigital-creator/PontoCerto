const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: DataTypes.UUID, // null para usuários administrativos sem vínculo de colaborador
  login: { type: DataTypes.STRING, allowNull: false, unique: true },
  senhaHash: { type: DataTypes.STRING, allowNull: false },
  perfil: {
    type: DataTypes.ENUM('colaborador', 'gestor', 'rh', 'admin'),
    defaultValue: 'colaborador',
  },
}, {
  tableName: 'usuarios',
});

module.exports = Usuario;
