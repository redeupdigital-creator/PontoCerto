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

// Uso: permitir('coordenador', 'admin')
function permitir(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Não autenticado' });
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Perfil sem permissão para esta ação' });
    }
    return next();
  };
}

// Restringe o acesso: se o usuário logado tem perfil "colaborador", ele só pode
// consultar/alterar registros referentes ao próprio colaboradorId. Todos os
// outros perfis (analista/coordenador/consulta/admin) passam livremente —
// não há mais escopo por equipe: desde a reformulação de perfis, o acesso
// operacional (coordenador) é sobre a empresa toda, e cada rota já usa
// `permitir(...)` para decidir quem tem elevação suficiente para cada ação.
// `getColaboradorId(req)` deve retornar o colaboradorId do recurso sendo
// acessado (lido de req.query, req.params ou req.body, conforme a rota).
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

module.exports = { autenticar, permitir, apenasProprioColaborador };
