const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Uma linha = um dia de um colaborador, com até 4 horários (E1/S1/E2/S2)
const Batida = sequelize.define('Batida', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  data: { type: DataTypes.DATEONLY, allowNull: false },
  e1: DataTypes.STRING, // "HH:MM"
  s1: DataTypes.STRING,
  e2: DataTypes.STRING,
  s2: DataTypes.STRING,
  // Geolocalização capturada no momento de cada batida (quando registrada
  // pelo app com GPS). Nula para batidas lançadas manualmente por RH/gestor.
  e1Lat: DataTypes.FLOAT,
  e1Lng: DataTypes.FLOAT,
  e1Precisao: DataTypes.FLOAT,
  s1Lat: DataTypes.FLOAT,
  s1Lng: DataTypes.FLOAT,
  s1Precisao: DataTypes.FLOAT,
  e2Lat: DataTypes.FLOAT,
  e2Lng: DataTypes.FLOAT,
  e2Precisao: DataTypes.FLOAT,
  s2Lat: DataTypes.FLOAT,
  s2Lng: DataTypes.FLOAT,
  s2Precisao: DataTypes.FLOAT,
  origem: { type: DataTypes.STRING, defaultValue: 'manual' }, // relogio | app | web | manual
}, {
  tableName: 'batidas',
  indexes: [{ unique: true, fields: ['colaboradorId', 'data'] }],
});

module.exports = Batida;
