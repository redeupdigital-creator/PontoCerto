const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Histórico de desligamentos de um colaborador — a mesma pessoa pode ser
// desligada e recontratada mais de uma vez; cada ciclo fica registrado aqui,
// separado do cadastro "atual" do colaborador.
const ColaboradorDesligamento = sequelize.define('ColaboradorDesligamento', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  dataAdmissaoDoCiclo: DataTypes.DATEONLY,
  dataDesligamento: { type: DataTypes.DATEONLY, allowNull: false },
  tipo: { type: DataTypes.STRING, allowNull: false },
  motivo: DataTypes.TEXT,
  anexoPath: DataTypes.STRING,
  registradoPor: DataTypes.STRING,
}, {
  tableName: 'colaborador_desligamentos',
});

module.exports = ColaboradorDesligamento;
