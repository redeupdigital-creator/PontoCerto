const express = require('express');
const { Op } = require('sequelize');
const { Colaborador, Ferias, Atestado, Ocorrencia, ColaboradorDesligamento, EpiSolicitacao } = require('../models');
const { calcularMes } = require('../services/calculo');
const { autenticar, permitir } = require('../middleware/auth');
const { gerarXlsx, gerarPdf } = require('../services/exportacao');
const { idsColaboradoresDaEmpresa } = require('../utils/empresa');

const router = express.Router();
router.use(autenticar);
// Relatórios são ferramenta de gestão/consulta: colaborador e analista não
// têm acesso direto (o colaborador já vê os próprios dados pelo cartão de
// ponto; analista fica restrito a ponto e abono).
router.use(permitir('coordenador', 'consulta', 'admin'));

// ---- Funções que montam as LINHAS de cada relatório (reaproveitadas por
// JSON e pelas exportações em Excel/PDF, para garantir que o dado exportado
// é sempre exatamente o mesmo que aparece na tela). ----

async function linhasFaltaAtraso(req) {
  const { mes } = req.query;
  if (!mes) return { erro: 'Informe mes (YYYY-MM)' };
  const [ano, mesNum] = mes.split('-').map(Number);

  const where = { empresaId: req.usuario.empresaId };
  if (req.query.colaboradorId) where.id = req.query.colaboradorId;
  const colaboradores = await Colaborador.findAll({ where });

  const linhas = [];
  for (const colaborador of colaboradores) {
    // eslint-disable-next-line no-await-in-loop
    const { dias } = await calcularMes(colaborador, ano, mesNum);
    dias.forEach((dia) => {
      if (dia.falta || dia.minutosAtraso > 0) {
        linhas.push({
          colaboradorId: colaborador.id,
          colaborador: colaborador.nome,
          matricula: colaborador.matricula,
          data: dia.data,
          ocorrencia: dia.falta ? 'falta' : 'atraso',
          minutos: dia.falta ? null : dia.minutosAtraso,
          horas: dia.falta ? null : dia.horasAtraso,
        });
      }
    });
  }
  return { mes, linhas };
}

async function linhasFerias(req) {
  const idsEmpresa = await idsColaboradoresDaEmpresa(req.usuario.empresaId);
  const where = { colaboradorId: { [Op.in]: idsEmpresa } };
  if (req.query.colaboradorId) {
    if (!idsEmpresa.includes(req.query.colaboradorId)) return { linhas: [] };
    where.colaboradorId = req.query.colaboradorId;
  }
  if (req.query.status) where.status = req.query.status;
  const registros = await Ferias.findAll({
    where,
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula'] }],
    order: [['dataInicioGozo', 'DESC']],
  });
  const linhas = registros.map((r) => {
    const p = r.get({ plain: true });
    return {
      colaborador: p.Colaborador ? p.Colaborador.nome : '—',
      matricula: p.Colaborador ? p.Colaborador.matricula : '—',
      periodoAquisitivo: `${p.periodoAquisitivoInicio || '—'} a ${p.periodoAquisitivoFim || '—'}`,
      gozo: `${p.dataInicioGozo} a ${p.dataFimGozo}`,
      diasAbonoPecuniario: p.diasAbonoPecuniario,
      status: p.status,
    };
  });
  return { linhas };
}

async function linhasOcorrencias(req) {
  const idsEmpresa = await idsColaboradoresDaEmpresa(req.usuario.empresaId);
  const where = { colaboradorId: { [Op.in]: idsEmpresa } };
  if (req.query.colaboradorId) {
    if (!idsEmpresa.includes(req.query.colaboradorId)) return { linhas: [] };
    where.colaboradorId = req.query.colaboradorId;
  }
  if (req.query.tipo) where.tipo = req.query.tipo;
  const registros = await Ocorrencia.findAll({
    where,
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula'] }],
    order: [['dataInicio', 'DESC']],
  });
  const linhas = registros.map((r) => {
    const p = r.get({ plain: true });
    return {
      colaborador: p.Colaborador ? p.Colaborador.nome : '—',
      matricula: p.Colaborador ? p.Colaborador.matricula : '—',
      tipo: p.tipo,
      periodo: `${p.dataInicio}${p.dataFim ? ' a ' + p.dataFim : ''}`,
      motivo: p.motivo || '—',
    };
  });
  return { linhas };
}

async function linhasAtestados(req) {
  const idsEmpresa = await idsColaboradoresDaEmpresa(req.usuario.empresaId);
  const where = { colaboradorId: { [Op.in]: idsEmpresa } };
  if (req.query.colaboradorId) {
    if (!idsEmpresa.includes(req.query.colaboradorId)) return { linhas: [] };
    where.colaboradorId = req.query.colaboradorId;
  }
  const registros = await Atestado.findAll({
    where,
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula'] }],
    order: [['dataInicio', 'DESC']],
  });
  const linhas = registros.map((r) => {
    const p = r.get({ plain: true });
    const dias = Math.round((new Date(p.dataFim) - new Date(p.dataInicio)) / 86400000) + 1;
    return {
      colaborador: p.Colaborador ? p.Colaborador.nome : '—',
      matricula: p.Colaborador ? p.Colaborador.matricula : '—',
      periodo: `${p.dataInicio} a ${p.dataFim}`,
      dias,
      exigeAfastamentoINSS: dias > 15 ? 'sim' : 'não',
      cid: p.cid || '—',
      medico: p.medico || '—',
    };
  });
  return { linhas };
}

async function linhasDesligamentos(req) {
  const idsEmpresa = await idsColaboradoresDaEmpresa(req.usuario.empresaId);
  const where = { colaboradorId: { [Op.in]: idsEmpresa } };
  if (req.query.colaboradorId) {
    if (!idsEmpresa.includes(req.query.colaboradorId)) return { linhas: [] };
    where.colaboradorId = req.query.colaboradorId;
  }
  if (req.query.dataInicio || req.query.dataFim) {
    where.dataDesligamento = {};
    if (req.query.dataInicio) where.dataDesligamento[Op.gte] = req.query.dataInicio;
    if (req.query.dataFim) where.dataDesligamento[Op.lte] = req.query.dataFim;
  }
  const registros = await ColaboradorDesligamento.findAll({
    where,
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula', 'cargo'] }],
    order: [['dataDesligamento', 'DESC']],
  });
  const rotuloTipo = {
    pedido_demissao: 'Pedido de demissão',
    dispensa_sem_justa_causa: 'Dispensa sem justa causa',
    dispensa_com_justa_causa: 'Dispensa com justa causa',
    termino_contrato: 'Término de contrato',
    outro: 'Outro',
  };
  const linhas = registros.map((r) => {
    const p = r.get({ plain: true });
    return {
      colaborador: p.Colaborador ? p.Colaborador.nome : '—',
      matricula: p.Colaborador ? p.Colaborador.matricula : '—',
      cargo: p.Colaborador ? p.Colaborador.cargo : '—',
      dataAdmissaoDoCiclo: p.dataAdmissaoDoCiclo || '—',
      dataDesligamento: p.dataDesligamento,
      tipo: rotuloTipo[p.tipo] || p.tipo,
      motivo: p.motivo || '—',
      temAnexo: p.anexoPath ? 'sim' : 'não',
    };
  });
  return { linhas };
}

async function linhasEpi(req) {
  const idsEmpresa = await idsColaboradoresDaEmpresa(req.usuario.empresaId);
  const where = { colaboradorId: { [Op.in]: idsEmpresa } };
  if (req.query.colaboradorId) {
    if (!idsEmpresa.includes(req.query.colaboradorId)) return { linhas: [] };
    where.colaboradorId = req.query.colaboradorId;
  }
  if (req.query.status) where.status = req.query.status;
  const registros = await EpiSolicitacao.findAll({
    where,
    include: [{ model: Colaborador, attributes: ['id', 'nome', 'matricula'] }],
    order: [['dataSolicitacao', 'DESC']],
  });
  const linhas = registros.map((r) => {
    const p = r.get({ plain: true });
    return {
      colaborador: p.Colaborador ? p.Colaborador.nome : '—',
      matricula: p.Colaborador ? p.Colaborador.matricula : '—',
      item: p.item,
      quantidade: p.quantidade,
      dataSolicitacao: p.dataSolicitacao,
      dataEntrega: p.dataEntrega || '—',
      status: p.status,
      temAnexo: p.anexoPath ? 'sim' : 'não',
    };
  });
  return { linhas };
}

// Configuração de colunas por tipo de relatório, usada na exportação.
const RELATORIOS = {  'falta-atraso': {
    titulo: 'Relatório de Falta e Atraso',
    obterLinhas: linhasFaltaAtraso,
    colunas: [
      { chave: 'colaborador', rotulo: 'Colaborador', largura: 28 },
      { chave: 'matricula', rotulo: 'Matrícula', largura: 14 },
      { chave: 'data', rotulo: 'Data', largura: 14 },
      { chave: 'ocorrencia', rotulo: 'Ocorrência', largura: 14 },
      { chave: 'horas', rotulo: 'Minutos', largura: 12 },
    ],
  },
  ferias: {
    titulo: 'Relatório de Férias',
    obterLinhas: linhasFerias,
    colunas: [
      { chave: 'colaborador', rotulo: 'Colaborador', largura: 28 },
      { chave: 'matricula', rotulo: 'Matrícula', largura: 14 },
      { chave: 'periodoAquisitivo', rotulo: 'Período Aquisitivo', largura: 24 },
      { chave: 'gozo', rotulo: 'Período de Gozo', largura: 24 },
      { chave: 'diasAbonoPecuniario', rotulo: 'Abono (dias)', largura: 14 },
      { chave: 'status', rotulo: 'Status', largura: 14 },
    ],
  },
  ocorrencias: {
    titulo: 'Relatório de Suspensão/Advertência',
    obterLinhas: linhasOcorrencias,
    colunas: [
      { chave: 'colaborador', rotulo: 'Colaborador', largura: 28 },
      { chave: 'matricula', rotulo: 'Matrícula', largura: 14 },
      { chave: 'tipo', rotulo: 'Tipo', largura: 16 },
      { chave: 'periodo', rotulo: 'Período', largura: 20 },
      { chave: 'motivo', rotulo: 'Motivo', largura: 40 },
    ],
  },
  atestados: {
    titulo: 'Relatório de Atestado',
    obterLinhas: linhasAtestados,
    colunas: [
      { chave: 'colaborador', rotulo: 'Colaborador', largura: 28 },
      { chave: 'matricula', rotulo: 'Matrícula', largura: 14 },
      { chave: 'periodo', rotulo: 'Período', largura: 22 },
      { chave: 'dias', rotulo: 'Dias', largura: 10 },
      { chave: 'exigeAfastamentoINSS', rotulo: 'Afast. INSS (>15d)', largura: 18 },
      { chave: 'cid', rotulo: 'CID', largura: 12 },
      { chave: 'medico', rotulo: 'Médico', largura: 20 },
    ],
  },
  desligamentos: {
    titulo: 'Relatório de Desligamentos',
    obterLinhas: linhasDesligamentos,
    colunas: [
      { chave: 'colaborador', rotulo: 'Colaborador', largura: 26 },
      { chave: 'matricula', rotulo: 'Matrícula', largura: 12 },
      { chave: 'cargo', rotulo: 'Cargo', largura: 20 },
      { chave: 'dataAdmissaoDoCiclo', rotulo: 'Admissão', largura: 12 },
      { chave: 'dataDesligamento', rotulo: 'Desligamento', largura: 14 },
      { chave: 'tipo', rotulo: 'Tipo', largura: 22 },
      { chave: 'motivo', rotulo: 'Motivo', largura: 34 },
      { chave: 'temAnexo', rotulo: 'Anexo', largura: 8 },
    ],
  },
  epi: {
    titulo: 'Relatório de Solicitações de EPI',
    obterLinhas: linhasEpi,
    colunas: [
      { chave: 'colaborador', rotulo: 'Colaborador', largura: 26 },
      { chave: 'matricula', rotulo: 'Matrícula', largura: 12 },
      { chave: 'item', rotulo: 'Item', largura: 22 },
      { chave: 'quantidade', rotulo: 'Qtd.', largura: 8 },
      { chave: 'dataSolicitacao', rotulo: 'Solicitado em', largura: 14 },
      { chave: 'dataEntrega', rotulo: 'Entregue em', largura: 14 },
      { chave: 'status', rotulo: 'Status', largura: 14 },
      { chave: 'temAnexo', rotulo: 'Anexo', largura: 8 },
    ],
  },
};

// ---- Rotas JSON (usadas pela tela) ----

router.get('/falta-atraso', async (req, res) => {
  const r = await linhasFaltaAtraso(req);
  if (r.erro) return res.status(400).json({ erro: r.erro });
  res.json({ mes: r.mes, total: r.linhas.length, linhas: r.linhas });
});

router.get('/ferias', async (req, res) => {
  const r = await linhasFerias(req);
  res.json(r.linhas);
});

router.get('/ocorrencias', async (req, res) => {
  const r = await linhasOcorrencias(req);
  res.json(r.linhas);
});

router.get('/atestados', async (req, res) => {
  const r = await linhasAtestados(req);
  res.json(r.linhas);
});

router.get('/desligamentos', async (req, res) => {
  const r = await linhasDesligamentos(req);
  res.json(r.linhas);
});

router.get('/epi', async (req, res) => {
  const r = await linhasEpi(req);
  res.json(r.linhas);
});

// ---- Rota de exportação: GET /api/relatorios/:tipo/exportar?formato=xlsx|pdf&mes=... ----
router.get('/:tipo/exportar', async (req, res) => {
  const config = RELATORIOS[req.params.tipo];
  if (!config) return res.status(404).json({ erro: 'Tipo de relatório desconhecido' });

  const formato = (req.query.formato || 'xlsx').toLowerCase();
  if (!['xlsx', 'pdf'].includes(formato)) {
    return res.status(400).json({ erro: 'Formato inválido. Use "xlsx" ou "pdf".' });
  }

  const resultado = await config.obterLinhas(req);
  if (resultado.erro) return res.status(400).json({ erro: resultado.erro });

  const subtitulo = resultado.mes ? `Referência: ${resultado.mes}` : `Gerado em ${new Date().toLocaleDateString('pt-BR')}`;
  const nomeArquivo = `${req.params.tipo}-${resultado.mes || new Date().toISOString().slice(0, 10)}`;

  try {
    if (formato === 'xlsx') {
      const buffer = await gerarXlsx({ titulo: config.titulo, subtitulo, colunas: config.colunas, linhas: resultado.linhas });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }
    const buffer = await gerarPdf({ titulo: config.titulo, subtitulo, colunas: config.colunas, linhas: resultado.linhas });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[exportacao] falha ao gerar arquivo:', err);
    return res.status(500).json({ erro: 'Falha ao gerar o arquivo de exportação' });
  }
});

module.exports = router;
