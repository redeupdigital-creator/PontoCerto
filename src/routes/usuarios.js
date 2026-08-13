const express = require('express');
const bcrypt = require('bcryptjs');
const { Usuario, Colaborador } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { PERFIS } = require('../constants/perfis');
const { registrar } = require('../services/auditoria');

const router = express.Router();
router.use(autenticar);

function perfilValido(perfil) {
  return PERFIS.includes(perfil);
}

// Qualquer usuário autenticado troca a PRÓPRIA senha, confirmando a senha
// atual. Fica ANTES do `permitir('admin')` abaixo de propósito — é a única
// rota deste arquivo que não é exclusiva de admin.
router.patch('/me/senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Informe senhaAtual e novaSenha' });
  if (novaSenha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres' });

  const usuario = await Usuario.findByPk(req.usuario.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

  const ok = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta' });

  usuario.senhaHash = await bcrypt.hash(novaSenha, 10);
  await usuario.save();
  res.json({ ok: true });
});

// Tudo abaixo é administração de usuários — exclusiva do admin. Nenhum outro
// perfil (incluindo coordenador) gerencia login/perfil de terceiros.
router.use(permitir('admin'));

// Listar usuários — nunca retorna o hash da senha.
router.get('/', async (req, res) => {
  const usuarios = await Usuario.findAll({
    where: { empresaId: req.usuario.empresaId },
    attributes: { exclude: ['senhaHash'] },
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula'] }],
    order: [['login', 'ASC']],
  });
  res.json(usuarios);
});

// Criar usuário/login para um colaborador (ou administrativo, sem colaboradorId)
router.post('/', async (req, res) => {
  const { login, senha, perfil, colaboradorId } = req.body;
  if (!login || !senha || !perfil) {
    return res.status(400).json({ erro: 'Informe login, senha e perfil' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
  }
  if (!perfilValido(perfil)) {
    return res.status(400).json({ erro: `Perfil inválido. Use um de: ${PERFIS.join(', ')}` });
  }
  const existente = await Usuario.findOne({ where: { login, empresaId: req.usuario.empresaId } });
  if (existente) return res.status(409).json({ erro: 'Já existe um usuário com este login' });

  const senhaHash = await bcrypt.hash(senha, 10);
  const usuario = await Usuario.create({ login, senhaHash, perfil, colaboradorId: colaboradorId || null, empresaId: req.usuario.empresaId });
  await registrar({ usuario: req.usuario, acao: 'create', entidade: 'Usuario', entidadeId: usuario.id, detalhes: { login, perfil } });
  const { senhaHash: _omit, ...semSenha } = usuario.get({ plain: true });
  res.status(201).json(semSenha);
});

// Atualizar perfil/vínculo de um usuário (não altera senha aqui — ver rotas dedicadas)
router.put('/:id', async (req, res) => {
  const usuario = await Usuario.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  const { perfil, colaboradorId } = req.body;
  if (perfil && !perfilValido(perfil)) {
    return res.status(400).json({ erro: `Perfil inválido. Use um de: ${PERFIS.join(', ')}` });
  }
  const perfilAntes = usuario.perfil;
  await usuario.update({
    perfil: perfil || usuario.perfil,
    colaboradorId: colaboradorId !== undefined ? colaboradorId : usuario.colaboradorId,
  });
  await registrar({ usuario: req.usuario, acao: 'update', entidade: 'Usuario', entidadeId: usuario.id, detalhes: { login: usuario.login, perfilAntes, perfilDepois: usuario.perfil } });
  const { senhaHash: _omit, ...semSenha } = usuario.get({ plain: true });
  res.json(semSenha);
});

// Remover usuário
router.delete('/:id', async (req, res) => {
  const usuario = await Usuario.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  await registrar({ usuario: req.usuario, acao: 'delete', entidade: 'Usuario', entidadeId: usuario.id, detalhes: { login: usuario.login, perfil: usuario.perfil } });
  await usuario.destroy();
  res.status(204).send();
});

// Admin reseta a senha de qualquer usuário (ex.: usuário esqueceu a senha)
router.patch('/:id/senha', async (req, res) => {
  const { novaSenha } = req.body;
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres' });
  }
  const usuario = await Usuario.findOne({ where: { id: req.params.id, empresaId: req.usuario.empresaId } });
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  usuario.senhaHash = await bcrypt.hash(novaSenha, 10);
  await usuario.save();
  await registrar({ usuario: req.usuario, acao: 'reset_senha', entidade: 'Usuario', entidadeId: usuario.id, detalhes: { login: usuario.login } });
  res.json({ ok: true });
});

module.exports = router;
