const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: DataTypes.UUID, // null para usuários administrativos sem vínculo de colaborador
  // null só é permitido para o perfil 'super_admin' (não pertence a
  // nenhuma empresa específica) — todo outro perfil precisa ter empresaId.
  // A obrigatoriedade condicional é reforçada na camada de aplicação
  // (rotas), não aqui no schema.
  empresaId: { type: DataTypes.UUID, allowNull: true },
  login: { type: DataTypes.STRING, allowNull: false },
  senhaHash: { type: DataTypes.STRING, allowNull: false },
  perfil: {
    type: DataTypes.STRING,
    defaultValue: 'colaborador',
  },
}, {
  tableName: 'usuarios',
});

module.exports = Usuario;
