const express = require('express');
const { Colaborador, JornadaVersao, ColaboradorDesligamento } = require('../models');
const { autenticar, permitir, apenasProprioColaborador } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadDocumento } = require('../middleware/upload');
const { salvarFoto } = require('../services/storage');
const { registrar } = require('../services/auditoria');
const { cpfValido } = require('../utils/cpf');
const { colaboradorDaEmpresa } = require('../utils/empresa');

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

// Listar: sempre restrito à empresa do usuário logado. Colaborador só se vê
// a si mesmo dentro disso; demais perfis veem todos DA MESMA EMPRESA.
router.get('/', async (req, res) => {
  const { perfil, colaboradorId, empresaId } = req.usuario;
  const where = { empresaId };
  if (perfil === 'colaborador') where.id = colaboradorId;
  if (req.query.status) where.status = req.query.status; // ?status=ativo — usado nos formulários pra não listar quem já saiu
  const colaboradores = await Colaborador.findAll({ where, order: [['nome', 'ASC']] });
  res.json(colaboradores);
});

// Verifica se já existe um colaborador INATIVO com esse CPF NA MESMA
// EMPRESA — usado pelo cadastro de novo colaborador pra detectar
// recontratação. Um CPF pode legitimamente existir em empresas diferentes
// (é a mesma pessoa trabalhando em lugares diferentes), então a busca fica
// restrita à empresa do usuário logado.
router.get('/verificar-cpf', permitir('coordenador', 'admin'), async (req, res) => {
  const cpf = (req.query.cpf || '').replace(/\D/g, '');
  if (!cpf) return res.status(400).json({ erro: 'Informe o CPF' });

  const existentes = await Colaborador.findAll({ where: { empresaId: req.usuario.empresaId } });
  const encontrado = existentes.find((c) => (c.cpf || '').replace(/\D/g, '') === cpf);
  if (!encontrado) return res.json({ encontrado: false });

  const desligamentos = await ColaboradorDesligamento.findAll({
    where: { colaboradorId: encontrado.id },
    order: [['dataDesligamento', 'DESC']],
  });

  res.json({
    encontrado: true,
    colaborador: encontrado,
    podeReativar: encontrado.status === 'inativo',
    historicoDesligamentos: desligamentos,
  });
});

// Buscar um (mesmo escopo acima — e agora também confere a empresa,
// independente do perfil, não só quando é o próprio colaborador)
router.get('/:id', apenasProprioColaborador(req => req.params.id), async (req, res) => {
  const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  res.json(colaborador);
});

// Histórico de jornadas do colaborador (para conferência/auditoria)
router.get('/:id/jornadas', apenasProprioColaborador(req => req.params.id), async (req, res) => {
  const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
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

    // CPF obrigatório e validado (não só "tem 11 dígitos" — confere os
    // dígitos verificadores de verdade). É peça-chave para o AFD, então
    // vale barrar aqui em vez de deixar entrar incompleto.
    if (!body.cpf) return res.status(400).json({ erro: 'CPF é obrigatório' });
    if (!cpfValido(body.cpf)) return res.status(400).json({ erro: 'CPF inválido (dígitos verificadores não conferem)' });

    // empresaId sempre vem do usuário logado (JWT), nunca do corpo da
    // requisição — impede alguém de criar colaborador em empresa alheia
    // manipulando o payload.
    body.empresaId = req.usuario.empresaId;

    if (req.file) body.fotoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);
    const colaborador = await Colaborador.create(body);

    // Primeira versão de jornada, vigente desde a admissão (ou hoje, se não
    // informada). Suporta escala cíclica (12x36, 6x1 etc.) via `tipoEscala`,
    // `ciclo` (array de horas por posição) e `dataReferenciaCiclo` — se não
    // vierem, cai no padrão "semanal" de sempre.
    const cicloBody = body.ciclo && typeof body.ciclo === 'string' ? JSON.parse(body.ciclo) : body.ciclo;
    await JornadaVersao.create({
      colaboradorId: colaborador.id,
      jornada: body.jornada || {},
      vigenciaInicio: body.dataAdmissao || hoje(),
      vigenciaFim: null,
      tipoEscala: body.tipoEscala || 'semanal',
      ciclo: cicloBody || null,
      dataReferenciaCiclo: body.dataReferenciaCiclo || null,
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
    const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
    if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
    const body = { ...req.body };
    delete body.empresaId; // nunca editável via payload — colaborador não migra de empresa por aqui
    if (body.jornada && typeof body.jornada === 'string') body.jornada = JSON.parse(body.jornada);

    // Se um CPF foi enviado (inclusive para preencher um cadastro legado que
    // ainda não tinha), ele precisa ser válido — mas não obrigamos a
    // reenviar CPF em toda edição que não mexe nesse campo.
    if (body.cpf !== undefined && body.cpf !== '' && !cpfValido(body.cpf)) {
      return res.status(400).json({ erro: 'CPF inválido (dígitos verificadores não conferem)' });
    }

    if (req.file) body.fotoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);

    const antes = { nome: colaborador.nome, cargo: colaborador.cargo, jornada: colaborador.jornada };

    const cicloBody = body.ciclo && typeof body.ciclo === 'string' ? JSON.parse(body.ciclo) : body.ciclo;
    const mudouEscala = body.tipoEscala === 'ciclica'
      ? true // qualquer envio de escala cíclica abre uma nova versão (é uma mudança de regime, não um ajuste incremental)
      : (body.jornada && JSON.stringify(body.jornada) !== JSON.stringify(colaborador.jornada));

    if (mudouEscala) {
      const vigenciaInicio = body.jornadaVigenciaInicio || hoje();
      const versaoAberta = await JornadaVersao.findOne({ where: { colaboradorId: colaborador.id, vigenciaFim: null } });
      if (versaoAberta) {
        await versaoAberta.update({ vigenciaFim: diaAnterior(vigenciaInicio) });
      }
      await JornadaVersao.create({
        colaboradorId: colaborador.id,
        jornada: body.jornada || (versaoAberta ? versaoAberta.jornada : {}),
        vigenciaInicio,
        vigenciaFim: null,
        tipoEscala: body.tipoEscala || 'semanal',
        ciclo: body.tipoEscala === 'ciclica' ? (cicloBody || null) : null,
        dataReferenciaCiclo: body.tipoEscala === 'ciclica' ? (body.dataReferenciaCiclo || null) : null,
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
  const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  await registrar({ usuario: req.usuario, acao: 'delete', entidade: 'Colaborador', entidadeId: colaborador.id, detalhes: { nome: colaborador.nome } });
  await colaborador.destroy();
  res.status(204).send();
});

// Desligar colaborador — registra o ciclo no histórico, marca o colaborador
// como inativo, e aceita anexo (termo de rescisão, aviso prévio etc.).
router.post('/:id/desligar', permitir('coordenador', 'admin'), uploadDocumento.single('anexo'), async (req, res) => {
  const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  const { tipo, motivo, dataDesligamento } = req.body;
  if (!tipo || !dataDesligamento) return res.status(400).json({ erro: 'Informe tipo e dataDesligamento' });

  let anexoPath = null;
  if (req.file) anexoPath = await salvarFoto(req.file.buffer, req.file.originalname, req.file.mimetype);

  await ColaboradorDesligamento.create({
    colaboradorId: colaborador.id,
    dataAdmissaoDoCiclo: colaborador.dataAdmissao,
    dataDesligamento,
    tipo,
    motivo,
    anexoPath,
    registradoPor: req.usuario.login,
  });

  await colaborador.update({
    status: 'inativo',
    dataDemissao: dataDesligamento,
    tipoDesligamento: tipo,
    motivoDesligamento: motivo,
    anexoDesligamentoPath: anexoPath,
  });

  await registrar({
    usuario: req.usuario, acao: 'desligar', entidade: 'Colaborador', entidadeId: colaborador.id,
    detalhes: { nome: colaborador.nome, tipo, dataDesligamento },
  });

  res.json(colaborador);
});

// Reativar colaborador (recontratação) — reabre o cadastro existente em vez
// de duplicar; o ciclo anterior já está preservado no histórico.
router.post('/:id/reativar', permitir('coordenador', 'admin'), async (req, res) => {
  const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  if (colaborador.status === 'ativo') return res.status(400).json({ erro: 'Este colaborador já está ativo' });

  const novaDataAdmissao = req.body.dataAdmissao || hoje();
  await colaborador.update({
    status: 'ativo',
    dataAdmissao: novaDataAdmissao,
    dataDemissao: null,
    tipoDesligamento: null,
    motivoDesligamento: null,
    anexoDesligamentoPath: null,
  });

  await registrar({
    usuario: req.usuario, acao: 'reativar', entidade: 'Colaborador', entidadeId: colaborador.id,
    detalhes: { nome: colaborador.nome, novaDataAdmissao },
  });

  res.json(colaborador);
});

// Histórico completo de ciclos de desligamento/recontratação de um colaborador
router.get('/:id/desligamentos', apenasProprioColaborador(req => req.params.id), async (req, res) => {
  const colaborador = await colaboradorDaEmpresa(req.params.id, req.usuario.empresaId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });
  const historico = await ColaboradorDesligamento.findAll({
    where: { colaboradorId: req.params.id },
    order: [['dataDesligamento', 'DESC']],
  });
  res.json(historico);
});

module.exports = router;
