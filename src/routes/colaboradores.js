const express = require('express');
const { Colaborador, JornadaVersao } = require('../models');
const { autenticar, permitir, apenasProprioColaborador } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');
const { registrar } = require('../services/auditoria');

const router = express.Router();
router.use(autenticar);

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function diaAnterior(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Listar: colaborador só se vê a si mesmo. Analista/coordenador/consulta/admin
// veem todos (leitura para analista/consulta; coordenador/admin podem editar).
router.get('/', async (req, res) => {
  const { perfil, colaboradorId } = req.usuario;
  const where = perfil === 'colaborador' ? { id: colaboradorId } : {};
  const colaboradores = await Colaborador.findAll({ where, order: [['nome', 'ASC']] });
  res.json(colaboradores);
});

// Buscar um (mesmo escopo acima)
router.get('/:id', apenasProprioColaborador(req => req.params.id), async (req, res) => {
  const colaborador = await Colaborador.findByPk(req.params.id);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  res.json(colaborador);
});

// Histórico de jornadas do colaborador (para conferência/auditoria)
router.get('/:id/jornadas', apenasProprioColaborador(req => req.params.id), async (req, res) => {
  const versoes = await JornadaVersao.findAll({
    where: { colaboradorId: req.params.id },
    order: [['vigenciaInicio', 'DESC']],
  });
  res.json(versoes);
});

// Criar (coordenador/admin), com upload de foto opcional (campo "foto")
router.post('/', permitir('coordenador', 'admin'), upload.single('foto'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.jornada && typeof body.jornada === 'string') body.jornada = JSON.parse(body.jornada);
    if (req.file) body.fotoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
    const colaborador = await Colaborador.create(body);

    // Primeira versão de jornada, vigente desde a admissão (ou hoje, se não informada)
    await JornadaVersao.create({
      colaboradorId: colaborador.id,
      jornada: body.jornada || {},
      vigenciaInicio: body.dataAdmissao || hoje(),
      vigenciaFim: null,
    });

    await registrar({ usuario: req.usuario, acao: 'create', entidade: 'Colaborador', entidadeId: colaborador.id, detalhes: { nome: colaborador.nome } });
    res.status(201).json(colaborador);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar (coordenador/admin). Se a jornada mudar, fecha a versão vigente e
// abre uma nova a partir de `jornadaVigenciaInicio` (ou hoje, por padrão) —
// isso preserva o cálculo correto de meses passados.
router.put('/:id', permitir('coordenador', 'admin'), upload.single('foto'), async (req, res) => {
  try {
    const colaborador = await Colaborador.findByPk(req.params.id);
    if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const body = { ...req.body };
    if (body.jornada && typeof body.jornada === 'string') body.jornada = JSON.parse(body.jornada);
    if (req.file) body.fotoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);

    const antes = { nome: colaborador.nome, cargo: colaborador.cargo, jornada: colaborador.jornada };

    if (body.jornada && JSON.stringify(body.jornada) !== JSON.stringify(colaborador.jornada)) {
      const vigenciaInicio = body.jornadaVigenciaInicio || hoje();
      const versaoAberta = await JornadaVersao.findOne({ where: { colaboradorId: colaborador.id, vigenciaFim: null } });
      if (versaoAberta) {
        await versaoAberta.update({ vigenciaFim: diaAnterior(vigenciaInicio) });
      }
      await JornadaVersao.create({
        colaboradorId: colaborador.id,
        jornada: body.jornada,
        vigenciaInicio,
        vigenciaFim: null,
      });
    }

    await colaborador.update(body);
    await registrar({
      usuario: req.usuario, acao: 'update', entidade: 'Colaborador', entidadeId: colaborador.id,
      detalhes: { antes, depois: { nome: colaborador.nome, cargo: colaborador.cargo, jornada: colaborador.jornada } },
    });
    res.json(colaborador);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Remover — ação sensível, restrita a admin
router.delete('/:id', permitir('admin'), async (req, res) => {
  const colaborador = await Colaborador.findByPk(req.params.id);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  await registrar({ usuario: req.usuario, acao: 'delete', entidade: 'Colaborador', entidadeId: colaborador.id, detalhes: { nome: colaborador.nome } });
  await colaborador.destroy();
  res.status(204).send();
});

module.exports = router;
