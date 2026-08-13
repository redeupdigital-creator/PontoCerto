const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario, Empresa } = require('../models');
const { autenticar } = require('../middleware/auth');
const { PERFIL_SUPER_ADMIN } = require('../constants/perfis');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { login, senha, empresaId } = req.body;
  if (!login || !senha) return res.status(400).json({ erro: 'Informe login e senha' });

  // Sem empresaId: só pode ser o Administrador do Sistema (super_admin não
  // pertence a nenhuma empresa). Com empresaId: login normal, escopado à
  // empresa selecionada.
  const usuario = empresaId
    ? await Usuario.findOne({ where: { login, empresaId } })
    : await Usuario.findOne({ where: { login, perfil: PERFIL_SUPER_ADMIN, empresaId: null } });

  if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const ok = await bcrypt.compare(senha, usuario.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

  let empresa = null;
  if (empresaId) {
    empresa = await Empresa.findOne({ where: { id: empresaId, ativa: true } });
    if (!empresa) return res.status(400).json({ erro: 'Empresa inválida' });
  }

  const token = jwt.sign(
    { id: usuario.id, login: usuario.login, perfil: usuario.perfil, colaboradorId: usuario.colaboradorId, empresaId: usuario.empresaId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token, perfil: usuario.perfil, colaboradorId: usuario.colaboradorId, empresaId: usuario.empresaId, empresaNome: empresa ? empresa.nome : null });
});

// Só o Administrador do Sistema chega aqui. Dado um empresaId de destino,
// emite um token novo "como admin" daquela empresa — é assim que ele entra
// em qualquer empresa para dar suporte, sem precisar da senha do admin
// local. Todas as rotas existentes continuam funcionando sem alteração
// nenhuma, porque o token resultante tem exatamente a cara de um login
// normal de admin (mesmo formato, mesmo req.usuario.empresaId).
router.post('/entrar-empresa', autenticar, async (req, res) => {
  if (req.usuario.perfil !== PERFIL_SUPER_ADMIN) {
    return res.status(403).json({ erro: 'Só o Administrador do Sistema pode entrar em outra empresa.' });
  }
  const { empresaId } = req.body;
  if (!empresaId) return res.status(400).json({ erro: 'Informe empresaId' });

  const empresa = await Empresa.findOne({ where: { id: empresaId, ativa: true } });
  if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada' });

  const token = jwt.sign(
    {
      id: req.usuario.id, login: req.usuario.login, perfil: 'admin', colaboradorId: null, empresaId: empresa.id,
      viaSuperAdmin: true, // sinaliza a origem, útil pra auditoria/depuração — não é usado hoje pra nenhuma regra especial
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token, perfil: 'admin', colaboradorId: null, empresaId: empresa.id, empresaNome: empresa.nome });
});

module.exports = router;
