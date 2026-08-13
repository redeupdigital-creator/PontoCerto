require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Colaborador, Usuario, Feriado, JornadaVersao, Empresa } = require('./models');

// CPFs de teste com dígitos verificadores válidos de verdade (passam pela
// mesma validação usada no cadastro real — não são números aleatórios).
const CPFS = [
  '100.000.000-19', '100.000.137-73', '100.000.274-80', '100.000.411-22', '100.000.548-87',
  '100.000.685-94', '100.000.822-36', '100.000.959-90', '100.001.096-14', '100.001.233-66',
  '100.001.370-73', '100.001.507-62', '100.001.644-70', '100.001.781-87', '100.001.918-76',
];
let cpfIndex = 0;
function proximoCpf() { return CPFS[cpfIndex++]; }

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

const JORNADA_PADRAO = { dom: 0, seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0 };

/**
 * Cria uma empresa completa: os 5 perfis de demonstração, feriados
 * nacionais básicos, e retorna um resumo pra imprimir no final.
 */
async function seedEmpresa({ nome, cnpj }) {
  const empresa = await Empresa.create({ nome, cnpj, razaoSocial: `${nome} LTDA` });

  const senhaAdmin = await bcrypt.hash('admin123', 10);
  await Usuario.create({ empresaId: empresa.id, login: 'admin', senhaHash: senhaAdmin, perfil: 'admin' });

  const coord = await criarColaborador({
    empresaId: empresa.id, nome: 'Paulo Mendes', matricula: '00001', cpf: proximoCpf(),
    cargo: 'Coordenador de RH', departamento: 'RH', dataAdmissao: '2020-01-15',
    email: `paulo.mendes@${nome.toLowerCase()}.example.com`, jornada: JORNADA_PADRAO,
  });
  await Usuario.create({ empresaId: empresa.id, colaboradorId: coord.id, login: 'paulo.mendes', senhaHash: await bcrypt.hash('coord123', 10), perfil: 'coordenador' });

  const analista = await criarColaborador({
    empresaId: empresa.id, nome: 'Fernanda Lima', matricula: '00002', cpf: proximoCpf(),
    cargo: 'Analista de Ponto', departamento: 'RH', dataAdmissao: '2022-06-01',
    email: `fernanda.lima@${nome.toLowerCase()}.example.com`, jornada: JORNADA_PADRAO,
  });
  await Usuario.create({ empresaId: empresa.id, colaboradorId: analista.id, login: 'fernanda.lima', senhaHash: await bcrypt.hash('analista123', 10), perfil: 'analista' });

  const consulta = await criarColaborador({
    empresaId: empresa.id, nome: 'Ricardo Alves', matricula: '00003', cpf: proximoCpf(),
    cargo: 'Diretor Financeiro', departamento: 'Diretoria', dataAdmissao: '2019-02-10',
    email: `ricardo.alves@${nome.toLowerCase()}.example.com`, jornada: JORNADA_PADRAO,
  });
  await Usuario.create({ empresaId: empresa.id, colaboradorId: consulta.id, login: 'ricardo.alves', senhaHash: await bcrypt.hash('consulta123', 10), perfil: 'consulta' });

  const colaborador = await criarColaborador({
    empresaId: empresa.id, nome: 'Maria da Silva', matricula: '00123', cpf: proximoCpf(),
    cargo: 'Assistente Administrativo', departamento: 'RH', dataAdmissao: '2023-03-01',
    email: `maria.silva@${nome.toLowerCase()}.example.com`, gestorId: coord.id, jornada: JORNADA_PADRAO,
  });
  await Usuario.create({ empresaId: empresa.id, colaboradorId: colaborador.id, login: 'maria.silva', senhaHash: await bcrypt.hash('colab123', 10), perfil: 'colaborador' });

  await criarColaborador({
    empresaId: empresa.id, nome: 'Carlos Souza', matricula: '00456', cpf: proximoCpf(),
    cargo: 'Analista Financeiro', departamento: 'Financeiro', dataAdmissao: '2024-01-10',
    email: `carlos.souza@${nome.toLowerCase()}.example.com`, jornada: JORNADA_PADRAO,
  });

  await Feriado.bulkCreate([
    { empresaId: empresa.id, data: '2026-01-01', descricao: 'Confraternização Universal' },
    { empresaId: empresa.id, data: '2026-09-07', descricao: 'Independência do Brasil' },
  ]);

  return empresa;
}

async function seed() {
  await sequelize.sync({ force: false });

  const jaExisteSuperAdmin = await Usuario.findOne({ where: { login: 'admin', perfil: 'super_admin' } });
  if (!jaExisteSuperAdmin) {
    const senhaSuperAdmin = await bcrypt.hash('super123', 10);
    await Usuario.create({ empresaId: null, login: 'admin', senhaHash: senhaSuperAdmin, perfil: 'super_admin' });
    console.log('Administrador do Sistema criado -> login: admin / senha: super123');
    console.log('(mesmo login "admin" que existe em cada empresa, mas é uma conta à parte — o que muda é a senha e o fato de não selecionar empresa no login)\n');
  }

  const jaExiste = await Empresa.findOne({ where: { nome: 'Codismolas' } });
  if (jaExiste) {
    console.log('Seed já executado anteriormente (empresa Codismolas já existe).');
    process.exit(0);
  }

  console.log('Criando as 3 empresas com dados de demonstração...\n');
  const codismolas = await seedEmpresa({ nome: 'Codismolas', cnpj: '11.111.111/0001-11' });
  const automolas = await seedEmpresa({ nome: 'AutoMolas', cnpj: '22.222.222/0001-22' });
  const nordeste = await seedEmpresa({ nome: 'Nordeste', cnpj: '33.333.333/0001-33' });

  console.log('✅ 3 empresas criadas, cada uma com 5 perfis de demonstração:\n');
  for (const empresa of [codismolas, automolas, nordeste]) {
    console.log(`── ${empresa.nome} (empresaId: ${empresa.id}) ──`);
    console.log('  admin         / admin123     -> Administrador (acesso total)');
    console.log('  paulo.mendes  / coord123     -> Coordenador');
    console.log('  fernanda.lima / analista123  -> Analista');
    console.log('  ricardo.alves / consulta123  -> Consulta');
    console.log('  maria.silva   / colab123     -> Colaborador\n');
  }
  console.log('Ao logar, selecione a empresa correspondente na tela de login —');
  console.log('o login "admin" existe nas 3, mas são contas completamente separadas.');

  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
