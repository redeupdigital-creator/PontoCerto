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
  toleranciaMin: { type: DataTypes.INTEGER, defaultValue: 5 },
  email: DataTypes.STRING,
  gestorId: DataTypes.UUID, // colaboradorId de quem é o gestor direto (para escopo de aprovação/consulta)
  // Campos usados na etiqueta impressa do cartão de ponto físico:
  numeroRegistro: DataTypes.STRING,
  ctps: DataTypes.STRING,
  localTrabalho: DataTypes.STRING,
}, {
  tableName: 'colaboradores',
});

module.exports = Colaborador;
