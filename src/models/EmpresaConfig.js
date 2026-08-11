const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Tabela pensada para uma única linha (configuração global da empresa),
// usada no cabeçalho do cartão de ponto e na etiqueta impressa.
const EmpresaConfig = sequelize.define('EmpresaConfig', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  razaoSocial: DataTypes.STRING,
  cnpj: DataTypes.STRING,
  atividadeEconomica: DataTypes.STRING,
  cpfResponsavelRegistros: DataTypes.STRING, // CPF de quem responde pelas inclusões/alterações no REP (AFD tipo 2)
  numeroRegistroInpiRepP: DataTypes.STRING, // número de registro do PTRP no INPI (AFD tipo 1, campo 7) — preencha após homologação
  localPrestacaoServico: DataTypes.STRING,
}, {
  tableName: 'empresa_config',
});

module.exports = EmpresaConfig;
