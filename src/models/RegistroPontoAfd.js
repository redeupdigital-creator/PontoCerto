const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const RegistroPontoAfd = sequelize.define('RegistroPontoAfd', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nsr: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  dataHoraMarcacao: { type: DataTypes.DATE, allowNull: false },
  dataHoraGravacao: { type: DataTypes.DATE, allowNull: false },
  idColetor: { type: DataTypes.STRING(2), allowNull: false },
  online: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  hashAnterior: DataTypes.STRING,
  hashAtual: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'registros_ponto_afd',
  // Convenção de uso: esta tabela é somente-inserção. Nenhuma rota da API
  // expõe update/delete para este model — ver src/services/afd.js.
});

module.exports = RegistroPontoAfd;
