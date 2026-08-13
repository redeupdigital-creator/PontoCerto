const express = require('express');
const bcrypt = require('bcryptjs');
const { Empresa, Usuario } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { PERFIL_SUPER_ADMIN } = require('../constants/perfis');

const router = express.Router();

// PÚBLICA (sem autenticação) — alimenta o seletor de empresa na tela de
// login. Só expõe id/nome, nada sensível (CNPJ etc. fica só depois de
// autenticado, na tela de Compliance).
router.get('/', async (req, res) => {
  const empresas = await Empresa.findAll({
    where: { ativa: true },
    attributes: ['id', 'nome'],
    order: [['nome', 'ASC']],
  });
  res.json(empresas);
});

// Cadastro de empresa nova — exclusivo do Administrador do Sistema. Cria a
// empresa e o primeiro usuário admin dela junto.
router.post('/', autenticar, permitir(PERFIL_SUPER_ADMIN), async (req, res) => {
  const { nomeEmpresa, cnpj, adminLogin, adminSenha } = req.body;
  if (!nomeEmpresa || !adminLogin || !adminSenha) {
    return res.status(400).json({ erro: 'Informe nomeEmpresa, adminLogin e adminSenha' });
  }
  if (adminSenha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
  }

  const empresa = await Empresa.create({ nome: nomeEmpresa, cnpj: cnpj || null });
  const senhaHash = await bcrypt.hash(adminSenha, 10);
  await Usuario.create({ empresaId: empresa.id, login: adminLogin, senhaHash, perfil: 'admin' });

  res.status(201).json({ id: empresa.id, nome: empresa.nome });
});

// A partir daqui, autenticado — edição dos dados da PRÓPRIA empresa
// (compliance: CNPJ, razão social etc.) e listagem administrativa completa.
router.use(autenticar);

// Listagem completa (todas as empresas, com mais detalhe) — só o
// Administrador do Sistema usa isso, pra escolher em qual empresa entrar.
router.get('/todas', permitir(PERFIL_SUPER_ADMIN), async (req, res) => {
  const empresas = await Empresa.findAll({ order: [['nome', 'ASC']] });
  res.json(empresas);
});

router.get('/minha', async (req, res) => {
  if (!req.usuario.empresaId) return res.status(400).json({ erro: 'Este usuário não está vinculado a uma empresa' });
  const empresa = await Empresa.findByPk(req.usuario.empresaId);
  if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada' });
  res.json(empresa);
});

router.put('/minha', permitir('admin'), async (req, res) => {
  const empresa = await Empresa.findByPk(req.usuario.empresaId);
  if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada' });
  const { nome, razaoSocial, cnpj, atividadeEconomica, cpfResponsavelRegistros, numeroRegistroInpiRepP, localPrestacaoServico } = req.body;
  await empresa.update({ nome, razaoSocial, cnpj, atividadeEconomica, cpfResponsavelRegistros, numeroRegistroInpiRepP, localPrestacaoServico });
  res.json(empresa);
});

module.exports = router;
