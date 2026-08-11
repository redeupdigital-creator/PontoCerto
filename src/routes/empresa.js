const express = require('express');
const { EmpresaConfig } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

const router = express.Router();
router.use(autenticar);

async function obterOuCriarConfig() {
  let config = await EmpresaConfig.findOne();
  if (!config) config = await EmpresaConfig.create({});
  return config;
}

// Qualquer usuário autenticado pode LER (é usado no cabeçalho do cartão/etiqueta).
router.get('/', async (req, res) => {
  const config = await obterOuCriarConfig();
  res.json(config);
});

// Só admin edita os dados da empresa (config fica fora do alcance do coordenador).
router.put('/', permitir('admin'), async (req, res) => {
  const config = await obterOuCriarConfig();
  const { razaoSocial, cnpj, atividadeEconomica, cpfResponsavelRegistros, numeroRegistroInpiRepP, localPrestacaoServico } = req.body;
  await config.update({ razaoSocial, cnpj, atividadeEconomica, cpfResponsavelRegistros, numeroRegistroInpiRepP, localPrestacaoServico });
  await registrar({ usuario: req.usuario, acao: 'update', entidade: 'Empresa', entidadeId: config.id, detalhes: { razaoSocial, cnpj } });
  res.json(config);
});

module.exports = router;
