const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Cada linha aqui é uma empresa-cliente isolada — colaboradores, usuários,
// feriados etc. pertencem a exatamente uma. Substitui o antigo
// EmpresaConfig (que era uma linha única, implícita para todo o sistema).
const Empresa = sequelize.define('Empresa', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nome: { type: DataTypes.STRING, allowNull: false },
  razaoSocial: DataTypes.STRING,
  cnpj: DataTypes.STRING,
  atividadeEconomica: DataTypes.STRING,
  cpfResponsavelRegistros: DataTypes.STRING,
  numeroRegistroInpiRepP: DataTypes.STRING,
  localPrestacaoServico: DataTypes.STRING,
  ativa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'empresas',
});

module.exports = Empresa;
