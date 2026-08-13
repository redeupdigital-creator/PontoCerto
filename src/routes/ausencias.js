const express = require('express');
const { Op } = require('sequelize');
const { Ferias, Atestado, Ocorrencia } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');
const { invalidarCacheColaborador } = require('../services/calculo');
const { uploadDocumento } = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');
const { colaboradorDaEmpresa, idsColaboradoresDaEmpresa } = require('../utils/empresa');

const router = express.Router();
router.use(autenticar);

function crudSimples(model, camposObrigatorios, nomeEntidade) {
  const r = express.Router();

  // Colaborador: só os próprios. Coordenador/consulta/admin: todos DA
  // MESMA EMPRESA (com filtro opcional). Analista não acessa ausências.
  r.get('/', permitir('colaborador', 'coordenador', 'consulta', 'admin'), async (req, res) => {
    const { perfil, colaboradorId: proprioId, empresaId } = req.usuario;
    const where = {};
    if (perfil === 'colaborador') {
      where.colaboradorId = proprioId;
    } else if (req.query.colaboradorId) {
      if (!(await colaboradorDaEmpresa(req.query.colaboradorId, empresaId))) return res.status(404).json({ erro: 'Colaborador não encontrado' });
      where.colaboradorId = req.query.colaboradorId;
    } else {
      where.colaboradorId = { [Op.in]: await idsColaboradoresDaEmpresa(empresaId) };
    }
    const registros = await model.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(registros);
  });

  // Cria o registro. Aceita anexo opcional no campo "anexo" (recibo de
  // férias, atestado médico, ou termo de advertência/suspensão, conforme o
  // sub-recurso) — mesmo upload genérico usado na foto de colaborador.
  r.post('/', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
    for (const campo of camposObrigatorios) {
      if (!req.body[campo]) return res.status(400).json({ erro: `Campo obrigatório: ${campo}` });
    }
    if (!(await colaboradorDaEmpresa(req.body.colaboradorId, req.usuario.empresaId))) {
      return res.status(404).json({ erro: 'Colaborador não encontrado' });
    }
    const body = { ...req.body };
    if (req.file) body.anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
    const registro = await model.create(body);
    if (registro.colaboradorId) invalidarCacheColaborador(registro.colaboradorId);
    await registrar({ usuario: req.usuario, acao: 'create', entidade: nomeEntidade, entidadeId: registro.id, detalhes: body });
    res.status(201).json(registro);
  });

  // Atualiza — também é como se anexa o comprovante depois, num registro que
  // já existia (ex.: férias cadastradas na hora, recibo assinado só depois).
  r.put('/:id', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
    const registro = await model.findByPk(req.params.id);
    if (!registro || !(await colaboradorDaEmpresa(registro.colaboradorId, req.usuario.empresaId))) {
      return res.status(404).json({ erro: 'Registro não encontrado' });
    }
    const body = { ...req.body };
    if (req.file) body.anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
    await registro.update(body);
    if (registro.colaboradorId) invalidarCacheColaborador(registro.colaboradorId);
    await registrar({ usuario: req.usuario, acao: 'update', entidade: nomeEntidade, entidadeId: registro.id, detalhes: body });
    res.json(registro);
  });

  r.delete('/:id', permitir('admin'), async (req, res) => {
    const registro = await model.findByPk(req.params.id);
    if (!registro || !(await colaboradorDaEmpresa(registro.colaboradorId, req.usuario.empresaId))) {
      return res.status(404).json({ erro: 'Registro não encontrado' });
    }
    if (registro.colaboradorId) invalidarCacheColaborador(registro.colaboradorId);
    await registrar({ usuario: req.usuario, acao: 'delete', entidade: nomeEntidade, entidadeId: registro.id, detalhes: { colaboradorId: registro.colaboradorId } });
    await registro.destroy();
    res.status(204).send();
  });

  return r;
}

router.use('/ferias', crudSimples(Ferias, ['colaboradorId', 'dataInicioGozo', 'dataFimGozo'], 'Ferias'));
router.use('/atestados', crudSimples(Atestado, ['colaboradorId', 'dataInicio', 'dataFim'], 'Atestado'));
router.use('/ocorrencias', crudSimples(Ocorrencia, ['colaboradorId', 'tipo', 'dataInicio'], 'Ocorrencia'));

module.exports = router;
