const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) return res.status(400).json({ erro: 'Informe login e senha' });

  const usuario = await Usuario.findOne({ where: { login } });
  if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const ok = await bcrypt.compare(senha, usuario.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const token = jwt.sign(
    { id: usuario.id, login: usuario.login, perfil: usuario.perfil, colaboradorId: usuario.colaboradorId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token, perfil: usuario.perfil, colaboradorId: usuario.colaboradorId });
});

module.exports = router;
