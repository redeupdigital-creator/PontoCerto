const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Histórico de jornadas de um colaborador. Sempre que a jornada semanal é
// alterada, a versão anterior é "fechada" (ganha vigenciaFim) e uma nova é
// aberta — isso garante que o cálculo de meses passados continue usando a
// jornada que estava valendo naquela época, mesmo que ela tenha mudado depois.
const JornadaVersao = sequelize.define('JornadaVersao', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  colaboradorId: { type: DataTypes.UUID, allowNull: false },
  jornada: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('jornada');
      return raw ? JSON.parse(raw) : {};
    },
    set(value) {
      this.setDataValue('jornada', JSON.stringify(value));
    },
  },
  vigenciaInicio: { type: DataTypes.DATEONLY, allowNull: false },
  vigenciaFim: { type: DataTypes.DATEONLY, allowNull: true }, // null = vigente
}, {
  tableName: 'jornada_versoes',
});

module.exports = JornadaVersao;
