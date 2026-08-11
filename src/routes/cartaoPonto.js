const express = require('express');
const { Colaborador } = require('../models');
const { calcularMes } = require('../services/calculo');
const { autenticar, apenasProprioColaborador } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/cartao-ponto/:colaboradorId?mes=2026-08
// Retorna todos os dados prontos para montar o cartão de ponto impresso:
// dados cadastrais + foto (URL) + tabela de batidas do mês + totais.
router.get('/:colaboradorId', apenasProprioColaborador(req => req.params.colaboradorId), async (req, res) => {
  const { colaboradorId } = req.params;
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ erro: 'Informe mes (YYYY-MM)' });

  const colaborador = await Colaborador.findByPk(colaboradorId);
  if (!colaborador) return res.status(404).json({ erro: 'Colaborador não encontrado' });

  const [ano, mesNum] = mes.split('-').map(Number);
  const { dias, totais } = await calcularMes(colaborador, ano, mesNum);

  res.json({
    colaborador: {
      id: colaborador.id,
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      cargo: colaborador.cargo,
      departamento: colaborador.departamento,
      dataAdmissao: colaborador.dataAdmissao,
      jornada: colaborador.jornada,
      fotoUrl: colaborador.fotoPath || null, // ex: /uploads/12345.jpg -> montar URL completa no front
    },
    periodo: { mes, dias: dias.length },
    dias,
    totais,
  });
});

module.exports = router;
