const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Tabela pensada para uma única linha (configuração global da empresa),
// usada no cabeçalho do cartão de ponto e na etiqueta impressa.
const EmpresaConfig = sequelize.define('EmpresaConfig', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  razaoSocial: DataTypes.STRING,
  cnpj: DataTypes.STRING,
  atividadeEconomica: DataTypes.STRING,
}, {
  tableName: 'empresa_config',
});

module.exports = EmpresaConfig;
