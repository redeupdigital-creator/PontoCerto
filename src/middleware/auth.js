const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não informado' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, login, perfil, colaboradorId }
    return next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// Uso: permitir('rh', 'admin')
function permitir(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Não autenticado' });
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Perfil sem permissão para esta ação' });
    }
    return next();
  };
}

// Retorna os IDs dos colaboradores liderados diretamente por `gestorColaboradorId`.
// Usado para escopar listas (relatórios, abonos, ausências) ao time do gestor.
async function idsDaEquipe(gestorColaboradorId) {
  // require tardio para evitar dependência circular no carregamento dos models
  const { Colaborador } = require('../models');
  const liderados = await Colaborador.findAll({ where: { gestorId: gestorColaboradorId }, attributes: ['id'] });
  return liderados.map((c) => c.id);
}

// Restringe o acesso: se o usuário logado tem perfil "colaborador", ele só pode
// consultar/alterar registros referentes ao próprio colaboradorId. Perfis
// gestor/rh/admin passam livremente (a autorização deles é tratada por `permitir`
// nas rotas que exigem elevação, como aprovar abono).
// `getColaboradorId(req)` deve retornar o colaboradorId do recurso sendo acessado
// (lido de req.query, req.params ou req.body, conforme a rota).
function apenasProprioColaborador(getColaboradorId) {
  return (req, res, next) => {
    if (req.usuario.perfil !== 'colaborador') return next();
    const alvo = getColaboradorId(req);
    if (!alvo) return res.status(400).json({ erro: 'colaboradorId é obrigatório' });
    if (alvo !== req.usuario.colaboradorId) {
      return res.status(403).json({ erro: 'Você só pode acessar seus próprios dados' });
    }
    return next();
  };
}

// Igual a `apenasProprioColaborador`, mas também libera o gestor para acessar
// dados de quem ele lidera diretamente (colaborador.gestorId === gestor.colaboradorId).
// RH/admin continuam com acesso irrestrito.
function apenasProprioOuEquipe(getColaboradorId) {
  return async (req, res, next) => {
    if (req.usuario.perfil === 'rh' || req.usuario.perfil === 'admin') return next();

    const alvo = getColaboradorId(req);
    if (!alvo) return res.status(400).json({ erro: 'colaboradorId é obrigatório' });

    if (alvo === req.usuario.colaboradorId) return next(); // é o próprio dono do recurso

    if (req.usuario.perfil === 'gestor') {
      const equipe = await idsDaEquipe(req.usuario.colaboradorId);
      if (equipe.includes(alvo)) return next();
      return res.status(403).json({ erro: 'Você só pode acessar dados da sua equipe' });
    }

    return res.status(403).json({ erro: 'Você só pode acessar seus próprios dados' });
  };
}

module.exports = { autenticar, permitir, apenasProprioColaborador, apenasProprioOuEquipe, idsDaEquipe };
