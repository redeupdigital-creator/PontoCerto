const sequelize = require('../db');
const Colaborador = require('./Colaborador');
const Batida = require('./Batida');
const Abono = require('./Abono');
const Ferias = require('./Ferias');
const Atestado = require('./Atestado');
const Ocorrencia = require('./Ocorrencia');
const Feriado = require('./Feriado');
const Usuario = require('./Usuario');
const Notificacao = require('./Notificacao');
const EmpresaConfig = require('./EmpresaConfig');

Colaborador.hasMany(Batida, { foreignKey: 'colaboradorId' });
Colaborador.hasMany(Abono, { foreignKey: 'colaboradorId' });
Colaborador.hasMany(Ferias, { foreignKey: 'colaboradorId' });
Colaborador.hasMany(Atestado, { foreignKey: 'colaboradorId' });
Colaborador.hasMany(Ocorrencia, { foreignKey: 'colaboradorId' });
Colaborador.hasOne(Usuario, { foreignKey: 'colaboradorId' });
Colaborador.hasMany(Notificacao, { foreignKey: 'colaboradorId' });
Notificacao.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

// Auto-relação: um colaborador pode ter um gestor (também um colaborador)
Colaborador.belongsTo(Colaborador, { as: 'Gestor', foreignKey: 'gestorId' });
Colaborador.hasMany(Colaborador, { as: 'Liderados', foreignKey: 'gestorId' });

Batida.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });
Abono.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });
Ferias.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });
Atestado.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });
Ocorrencia.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });
Usuario.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

module.exports = {
  sequelize,
  Colaborador,
  Batida,
  Abono,
  Ferias,
  Atestado,
  Ocorrencia,
  Feriado,
  Usuario,
  Notificacao,
  EmpresaConfig,
};
