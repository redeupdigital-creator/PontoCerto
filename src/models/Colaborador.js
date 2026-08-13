const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Colaborador = sequelize.define('Colaborador', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nome: { type: DataTypes.STRING, allowNull: false },
  matricula: DataTypes.STRING,
  cargo: DataTypes.STRING,
  departamento: DataTypes.STRING,
  dataAdmissao: DataTypes.DATEONLY,
  dataDemissao: DataTypes.DATEONLY,
  status: { type: DataTypes.STRING, defaultValue: 'ativo' }, // ativo | inativo
  fotoPath: DataTypes.STRING, // caminho relativo do arquivo de foto (uploads/)
  // jornada semanal em horas, ex: {"seg":8,"ter":8,"qua":8,"qui":8,"sex":8,"sab":0,"dom":0}
  jornada: {
    type: DataTypes.TEXT,
    defaultValue: JSON.stringify({ dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 }),
    get() {
      const raw = this.getDataValue('jornada');
      return raw ? JSON.parse(raw) : {};
    },
    set(value) {
      this.setDataValue('jornada', JSON.stringify(value));
    },
  },
  toleranciaMin: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    set(value) {
      // Garante inteiro mesmo quando vem como string de formulário
      // (multipart/form-data) — sem isso, o valor em memória logo após
      // criar/atualizar fica como string até a próxima leitura do banco,
      // o que quebra somas numéricas (ex: "480" + "10" = "48010").
      this.setDataValue('toleranciaMin', value === '' || value === null || value === undefined ? 5 : parseInt(value, 10));
    },
  },
  horaEntradaPadrao: { type: DataTypes.STRING(5), defaultValue: '08:00' }, // "HH:MM" — usado no painel ao vivo para saber quem está atrasado agora
  email: DataTypes.STRING,
  gestorId: DataTypes.UUID, // informativo (quem é o coordenador/responsável direto); não é mais usado para controle de acesso
  // Campos usados na etiqueta impressa do cartão de ponto físico:
  numeroRegistro: DataTypes.STRING,
  ctps: DataTypes.STRING,
  localTrabalho: DataTypes.STRING,
  cpf: DataTypes.STRING, // necessário para o AFD (Portaria 671/2021)
  empresaId: { type: DataTypes.UUID, allowNull: false }, // isolamento multi-empresa
  // Desligamento / recontratação:
  tipoDesligamento: DataTypes.STRING,
  motivoDesligamento: DataTypes.TEXT,
  anexoDesligamentoPath: DataTypes.STRING,
  // Folha de pagamento:
  salarioBase: DataTypes.DECIMAL(10, 2),
  tipoContrato: { type: DataTypes.STRING, defaultValue: 'clt' },
  banco: DataTypes.STRING,
  agencia: DataTypes.STRING,
  conta: DataTypes.STRING,
  tipoConta: DataTypes.STRING,
  chavePix: DataTypes.STRING,
}, {
  tableName: 'colaboradores',
});

module.exports = Colaborador;
