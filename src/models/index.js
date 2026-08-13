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
const JornadaVersao = require('./JornadaVersao');
const Auditoria = require('./Auditoria');
const RegistroPontoAfd = require('./RegistroPontoAfd');
const ColaboradorDesligamento = require('./ColaboradorDesligamento');
const Nr1Acao = require('./Nr1Acao');
const Nr1Participacao = require('./Nr1Participacao');
const EpiSolicitacao = require('./EpiSolicitacao');
const Holerite = require('./Holerite');
const Empresa = require('./Empresa');

Colaborador.hasMany(JornadaVersao, { foreignKey: 'colaboradorId' });
JornadaVersao.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });
Colaborador.hasMany(RegistroPontoAfd, { foreignKey: 'colaboradorId' });
RegistroPontoAfd.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

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

// Desligamento / recontratação
Colaborador.hasMany(ColaboradorDesligamento, { foreignKey: 'colaboradorId' });
ColaboradorDesligamento.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

// NR-1
Nr1Acao.hasMany(Nr1Participacao, { foreignKey: 'acaoId' });
Nr1Participacao.belongsTo(Nr1Acao, { foreignKey: 'acaoId' });
Colaborador.hasMany(Nr1Participacao, { foreignKey: 'colaboradorId' });
Nr1Participacao.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

// EPI
Colaborador.hasMany(EpiSolicitacao, { foreignKey: 'colaboradorId' });
EpiSolicitacao.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

// Folha de pagamento
Colaborador.hasMany(Holerite, { foreignKey: 'colaboradorId' });
Holerite.belongsTo(Colaborador, { foreignKey: 'colaboradorId' });

// Multi-empresa: isolamento direto (colaborador/usuário/feriado/NR-1/
// auditoria/notificação amarrados à empresa). Tudo mais que pertence a um
// colaborador já fica isolado indiretamente através dele.
Empresa.hasMany(Colaborador, { foreignKey: 'empresaId' });
Colaborador.belongsTo(Empresa, { foreignKey: 'empresaId' });
Empresa.hasMany(Usuario, { foreignKey: 'empresaId' });
Usuario.belongsTo(Empresa, { foreignKey: 'empresaId' });
Empresa.hasMany(Feriado, { foreignKey: 'empresaId' });
Feriado.belongsTo(Empresa, { foreignKey: 'empresaId' });
Empresa.hasMany(Nr1Acao, { foreignKey: 'empresaId' });
Nr1Acao.belongsTo(Empresa, { foreignKey: 'empresaId' });
Empresa.hasMany(Auditoria, { foreignKey: 'empresaId' });
Empresa.hasMany(Notificacao, { foreignKey: 'empresaId' });

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
  JornadaVersao,
  Auditoria,
  RegistroPontoAfd,
  ColaboradorDesligamento,
  Nr1Acao,
  Nr1Participacao,
  EpiSolicitacao,
  Holerite,
  Empresa,
};
