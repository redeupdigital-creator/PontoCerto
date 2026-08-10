require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Colaborador, Usuario, Feriado } = require('./models');

async function seed() {
  await sequelize.sync({ force: false });

  const existente = await Usuario.findOne({ where: { login: 'admin' } });
  if (existente) {
    console.log('Seed já executado anteriormente (usuário admin já existe).');
    process.exit(0);
  }

  const senhaHash = await bcrypt.hash('admin123', 10);
  await Usuario.create({ login: 'admin', senhaHash, perfil: 'admin' });
  console.log('Usuário admin criado -> login: admin / senha: admin123');

  // Gestor (é também um colaborador, para poder liderar outros colaboradores)
  const gestorColab = await Colaborador.create({
    nome: 'Paulo Mendes',
    matricula: '00001',
    cargo: 'Coordenador de RH',
    departamento: 'RH',
    dataAdmissao: '2020-01-15',
    email: 'paulo.mendes@example.com',
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  const senhaGestor = await bcrypt.hash('gestor123', 10);
  await Usuario.create({ colaboradorId: gestorColab.id, login: 'paulo.mendes', senhaHash: senhaGestor, perfil: 'gestor' });
  console.log(`Gestor criado: ${gestorColab.nome} -> login: paulo.mendes / senha: gestor123`);

  // Colaborador liderado por Paulo, com login próprio (self-service)
  const colaborador = await Colaborador.create({
    nome: 'Maria da Silva',
    matricula: '00123',
    cargo: 'Analista Administrativo',
    departamento: 'RH',
    dataAdmissao: '2023-03-01',
    email: 'maria.silva@example.com',
    gestorId: gestorColab.id,
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  console.log(`Colaborador de exemplo criado: ${colaborador.nome} (${colaborador.id}), liderado por ${gestorColab.nome}`);

  const senhaColab = await bcrypt.hash('colab123', 10);
  await Usuario.create({ colaboradorId: colaborador.id, login: 'maria.silva', senhaHash: senhaColab, perfil: 'colaborador' });
  console.log('Usuário colaborador criado -> login: maria.silva / senha: colab123 (acesso restrito aos próprios dados)');

  // Colaborador de outro time (sem gestorId apontando pra Paulo), para testar o isolamento
  await Colaborador.create({
    nome: 'Carlos Souza',
    matricula: '00456',
    cargo: 'Analista Financeiro',
    departamento: 'Financeiro',
    dataAdmissao: '2024-01-10',
    email: 'carlos.souza@example.com',
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  console.log('Colaborador de outro time criado: Carlos Souza (sem gestor definido, para testes de isolamento)');

  await Feriado.bulkCreate([
    { data: '2026-01-01', descricao: 'Confraternização Universal' },
    { data: '2026-09-07', descricao: 'Independência do Brasil' },
  ]);
  console.log('Feriados de exemplo cadastrados.');

  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
