const express = require('express');
const { Ferias, Atestado, Ocorrencia } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

const router = express.Router();
router.use(autenticar);

function crudSimples(model, camposObrigatorios, nomeEntidade) {
  const r = express.Router();

  // Colaborador: só os próprios. Coordenador/consulta/admin: todos (com
  // filtro opcional). Analista não acessa ausências (fora do seu escopo).
  r.get('/', permitir('colaborador', 'coordenador', 'consulta', 'admin'), async (req, res) => {
    const { perfil, colaboradorId: proprioId } = req.usuario;
    const where = {};
    if (perfil === 'colaborador') {
      where.colaboradorId = proprioId;
    } else if (req.query.colaboradorId) {
      where.colaboradorId = req.query.colaboradorId;
    }
    const registros = await model.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(registros);
  });

  r.post('/', permitir('coordenador', 'admin'), async (req, res) => {
    for (const campo of camposObrigatorios) {
      if (!req.body[campo]) return res.status(400).json({ erro: `Campo obrigatório: ${campo}` });
    }
    const registro = await model.create(req.body);
    await registrar({ usuario: req.usuario, acao: 'create', entidade: nomeEntidade, entidadeId: registro.id, detalhes: req.body });
    res.status(201).json(registro);
  });

  r.put('/:id', permitir('coordenador', 'admin'), async (req, res) => {
    const registro = await model.findByPk(req.params.id);
    if (!registro) return res.status(404).json({ erro: 'Registro não encontrado' });
    await registro.update(req.body);
    await registrar({ usuario: req.usuario, acao: 'update', entidade: nomeEntidade, entidadeId: registro.id, detalhes: req.body });
    res.json(registro);
  });

  r.delete('/:id', permitir('admin'), async (req, res) => {
    const registro = await model.findByPk(req.params.id);
    if (!registro) return res.status(404).json({ erro: 'Registro não encontrado' });
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
