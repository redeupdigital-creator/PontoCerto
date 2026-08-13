const { Auditoria } = require('../models');

/**
 * Registra uma entrada de auditoria. Nunca lança erro para quem chamou —
 * uma falha ao gravar auditoria não pode impedir a operação principal
 * (o mesmo padrão defensivo usado em services/notificacoes.js).
 *
 * @param {object} params
 * @param {object} params.usuario - req.usuario (payload do JWT: id, login, perfil)
 * @param {string} params.acao - 'create' | 'update' | 'delete' | 'aprovar' | 'reprovar' | 'reset_senha' | ...
 * @param {string} params.entidade - nome do model afetado, ex: 'Colaborador'
 * @param {string} [params.entidadeId]
 * @param {object} [params.detalhes] - resumo do que mudou (serializado como JSON)
 */
async function registrar({ usuario, acao, entidade, entidadeId = null, detalhes = null }) {
  try {
    await Auditoria.create({
      empresaId: usuario ? usuario.empresaId : null,
      usuarioId: usuario ? usuario.id : null,
      usuarioLogin: usuario ? usuario.login : null,
      perfil: usuario ? usuario.perfil : null,
      acao,
      entidade,
      entidadeId,
      detalhes: detalhes ? JSON.stringify(detalhes) : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditoria] falha ao registrar (operação principal segue normalmente):', err.message);
  }
}

module.exports = { registrar };
