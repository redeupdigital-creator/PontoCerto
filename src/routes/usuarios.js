const express = require('express');
const bcrypt = require('bcryptjs');
const { Usuario, Colaborador } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Só admin pode conceder o perfil "admin" a alguém — evita que RH escale
// privilégio criando outro admin sem essa permissão explícita.
function podeAtribuirPerfil(req, perfil) {
  if (perfil === 'admin') return req.usuario.perfil === 'admin';
  return true;
}

// Listar usuários (RH/admin) — nunca retorna o hash da senha.
router.get('/', permitir('rh', 'admin'), async (req, res) => {
  const usuarios = await Usuario.findAll({
    attributes: { exclude: ['senhaHash'] },
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula'] }],
    order: [['login', 'ASC']],
  });
  res.json(usuarios);
});

// Criar usuário/login para um colaborador (ou administrativo, sem colaboradorId)
router.post('/', permitir('rh', 'admin'), async (req, res) => {
  const { login, senha, perfil, colaboradorId } = req.body;
  if (!login || !senha || !perfil) {
    return res.status(400).json({ erro: 'Informe login, senha e perfil' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
  }
  if (!podeAtribuirPerfil(req, perfil)) {
    return res.status(403).json({ erro: 'Apenas um admin pode criar outro usuário admin' });
  }
  const existente = await Usuario.findOne({ where: { login } });
  if (existente) return res.status(409).json({ erro: 'Já existe um usuário com este login' });

  const senhaHash = await bcrypt.hash(senha, 10);
  const usuario = await Usuario.create({ login, senhaHash, perfil, colaboradorId: colaboradorId || null });
  const { senhaHash: _omit, ...semSenha } = usuario.get({ plain: true });
  res.status(201).json(semSenha);
});

// Atualizar perfil/vínculo de um usuário (não altera senha aqui — ver rotas dedicadas)
router.put('/:id', permitir('rh', 'admin'), async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  const { perfil, colaboradorId } = req.body;
  if (perfil && !podeAtribuirPerfil(req, perfil)) {
    return res.status(403).json({ erro: 'Apenas um admin pode conceder o perfil admin' });
  }
  await usuario.update({
    perfil: perfil || usuario.perfil,
    colaboradorId: colaboradorId !== undefined ? colaboradorId : usuario.colaboradorId,
  });
  const { senhaHash: _omit, ...semSenha } = usuario.get({ plain: true });
  res.json(semSenha);
});

// Remover usuário — restrito a admin (ação sensível: revoga acesso de alguém)
router.delete('/:id', permitir('admin'), async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  await usuario.destroy();
  res.status(204).send();
});

// Qualquer usuário autenticado troca a PRÓPRIA senha, confirmando a senha atual.
// IMPORTANTE: precisa vir ANTES de "/:id/senha" abaixo, senão "me" seria
// interpretado como um :id e cairia na rota restrita a rh/admin.
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

// RH/admin resetam a senha de qualquer usuário (ex.: usuário esqueceu a senha)
router.patch('/:id/senha', permitir('rh', 'admin'), async (req, res) => {
  const { novaSenha } = req.body;
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres' });
  }
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  usuario.senhaHash = await bcrypt.hash(novaSenha, 10);
  await usuario.save();
  res.json({ ok: true });
});

module.exports = router;
