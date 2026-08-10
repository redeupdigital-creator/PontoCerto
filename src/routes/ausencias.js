const express = require('express');
const { Op } = require('sequelize');
const { Ferias, Atestado, Ocorrencia } = require('../models');
const { autenticar, permitir, apenasProprioOuEquipe, idsDaEquipe } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

function crudSimples(model, camposObrigatorios) {
  const r = express.Router();

  // Colaborador: só os próprios. Gestor: os próprios + os da equipe (ou só um
  // colaborador específico da equipe, se colaboradorId for informado). RH/admin: todos.
  r.get('/', async (req, res) => {
    const { perfil, colaboradorId: proprioId } = req.usuario;
    const where = {};

    if (perfil === 'colaborador') {
      where.colaboradorId = proprioId;
    } else if (perfil === 'gestor') {
      if (req.query.colaboradorId) {
        const equipe = await idsDaEquipe(proprioId);
        if (req.query.colaboradorId !== proprioId && !equipe.includes(req.query.colaboradorId)) {
          return res.status(403).json({ erro: 'Você só pode acessar dados da sua equipe' });
        }
        where.colaboradorId = req.query.colaboradorId;
      } else {
        const equipe = await idsDaEquipe(proprioId);
        where.colaboradorId = { [Op.in]: [proprioId, ...equipe] };
      }
    } else if (req.query.colaboradorId) {
      where.colaboradorId = req.query.colaboradorId; // rh/admin com filtro opcional
    }

    const registros = await model.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(registros);
  });

  r.post('/', permitir('rh', 'admin', 'gestor'), apenasProprioOuEquipe(req => req.body.colaboradorId), async (req, res) => {
    for (const campo of camposObrigatorios) {
      if (!req.body[campo]) return res.status(400).json({ erro: `Campo obrigatório: ${campo}` });
    }
    const registro = await model.create(req.body);
    res.status(201).json(registro);
  });

  r.put('/:id', permitir('rh', 'admin', 'gestor'), async (req, res) => {
    const registro = await model.findByPk(req.params.id);
    if (!registro) return res.status(404).json({ erro: 'Registro não encontrado' });
    if (req.usuario.perfil === 'gestor') {
      const equipe = await idsDaEquipe(req.usuario.colaboradorId);
      if (!equipe.includes(registro.colaboradorId) && registro.colaboradorId !== req.usuario.colaboradorId) {
        return res.status(403).json({ erro: 'Você só pode alterar dados da sua equipe' });
      }
    }
    await registro.update(req.body);
    res.json(registro);
  });

  r.delete('/:id', permitir('rh', 'admin'), async (req, res) => {
    const registro = await model.findByPk(req.params.id);
    if (!registro) return res.status(404).json({ erro: 'Registro não encontrado' });
    await registro.destroy();
    res.status(204).send();
  });

  return r;
}

router.use('/ferias', crudSimples(Ferias, ['colaboradorId', 'dataInicioGozo', 'dataFimGozo']));
router.use('/atestados', crudSimples(Atestado, ['colaboradorId', 'dataInicio', 'dataFim']));
router.use('/ocorrencias', crudSimples(Ocorrencia, ['colaboradorId', 'tipo', 'dataInicio']));

module.exports = router;
