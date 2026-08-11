require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Colaborador, Usuario, Feriado, JornadaVersao } = require('./models');

async function criarColaborador(dados) {
  const colaborador = await Colaborador.create(dados);
  await JornadaVersao.create({
    colaboradorId: colaborador.id,
    jornada: dados.jornada || {},
    vigenciaInicio: dados.dataAdmissao || new Date().toISOString().slice(0, 10),
    vigenciaFim: null,
  });
  return colaborador;
}

async function seed() {
  await sequelize.sync({ force: false });

  const existente = await Usuario.findOne({ where: { login: 'admin' } });
  if (existente) {
    console.log('Seed já executado anteriormente (usuário admin já existe).');
    process.exit(0);
  }

  const senhaHash = await bcrypt.hash('admin123', 10);
  await Usuario.create({ login: 'admin', senhaHash, perfil: 'admin' });
  console.log('Usuário admin criado -> login: admin / senha: admin123 (acesso total)');

  // Coordenador (também é um colaborador — hoje isso é só informativo, não
  // afeta mais o que ele pode acessar: coordenador é operacional para a
  // empresa toda, não escopado por equipe)
  const coordColab = await criarColaborador({
    nome: 'Paulo Mendes',
    matricula: '00001',
    cpf: '111.111.111-11',
    cargo: 'Coordenador de RH',
    departamento: 'RH',
    dataAdmissao: '2020-01-15',
    email: 'paulo.mendes@example.com',
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  const senhaCoord = await bcrypt.hash('coord123', 10);
  await Usuario.create({ colaboradorId: coordColab.id, login: 'paulo.mendes', senhaHash: senhaCoord, perfil: 'coordenador' });
  console.log(`Coordenador criado: ${coordColab.nome} -> login: paulo.mendes / senha: coord123 (operacional completo, sem usuários/config)`);

  // Analista (lança/consulta ponto e abono; não cadastra colaborador)
  const analistaColab = await criarColaborador({
    nome: 'Fernanda Lima',
    matricula: '00002',
    cpf: '222.222.222-22',
    cargo: 'Analista de Ponto',
    departamento: 'RH',
    dataAdmissao: '2022-06-01',
    email: 'fernanda.lima@example.com',
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  const senhaAnalista = await bcrypt.hash('analista123', 10);
  await Usuario.create({ colaboradorId: analistaColab.id, login: 'fernanda.lima', senhaHash: senhaAnalista, perfil: 'analista' });
  console.log(`Analista criado: ${analistaColab.nome} -> login: fernanda.lima / senha: analista123 (ponto e abono)`);

  // Consulta (somente leitura)
  const consultaColab = await criarColaborador({
    nome: 'Ricardo Alves',
    matricula: '00003',
    cpf: '333.333.333-33',
    cargo: 'Diretor Financeiro',
    departamento: 'Diretoria',
    dataAdmissao: '2019-02-10',
    email: 'ricardo.alves@example.com',
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  const senhaConsulta = await bcrypt.hash('consulta123', 10);
  await Usuario.create({ colaboradorId: consultaColab.id, login: 'ricardo.alves', senhaHash: senhaConsulta, perfil: 'consulta' });
  console.log(`Consulta criado: ${consultaColab.nome} -> login: ricardo.alves / senha: consulta123 (somente leitura)`);

  // Colaborador comum, com login próprio (self-service). Jornada com um
  // pedaço no turno da noite, de propósito, para exercitar o cálculo de
  // adicional noturno nos testes.
  const colaborador = await criarColaborador({
    nome: 'Maria da Silva',
    matricula: '00123',
    cpf: '444.444.444-44',
    cargo: 'Assistente Administrativo',
    departamento: 'RH',
    dataAdmissao: '2023-03-01',
    email: 'maria.silva@example.com',
    gestorId: coordColab.id,
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  const senhaColab = await bcrypt.hash('colab123', 10);
  await Usuario.create({ colaboradorId: colaborador.id, login: 'maria.silva', senhaHash: senhaColab, perfil: 'colaborador' });
  console.log(`Colaborador criado: ${colaborador.nome} -> login: maria.silva / senha: colab123 (acesso restrito aos próprios dados)`);

  // Colaborador extra, sem login, só para os cadastros terem mais de uma pessoa
  await criarColaborador({
    nome: 'Carlos Souza',
    matricula: '00456',
    cpf: '555.555.555-55',
    cargo: 'Analista Financeiro',
    departamento: 'Financeiro',
    dataAdmissao: '2024-01-10',
    email: 'carlos.souza@example.com',
    jornada: { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 },
  });
  console.log('Colaborador de exemplo (sem login) criado: Carlos Souza');

  await Feriado.bulkCreate([
    { data: '2026-01-01', descricao: 'Confraternização Universal' },
    { data: '2026-09-07', descricao: 'Independência do Brasil' },
  ]);
  console.log('Feriados de exemplo cadastrados.');

  console.log('\nResumo dos logins de teste:');
  console.log('  admin         / admin123     -> Administrador (acesso total)');
  console.log('  paulo.mendes  / coord123     -> Coordenador (operacional completo, sem usuários/config)');
  console.log('  fernanda.lima / analista123  -> Analista (ponto e abono)');
  console.log('  ricardo.alves / consulta123  -> Consulta (somente leitura)');
  console.log('  maria.silva   / colab123     -> Colaborador (autoatendimento)');

  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
