const express = require('express');
const { EmpresaConfig } = require('../models');
const { autenticar, permitir } = require('../middleware/auth');

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

// Só RH/admin podem editar os dados da empresa.
router.put('/', permitir('rh', 'admin'), async (req, res) => {
  const config = await obterOuCriarConfig();
  const { razaoSocial, cnpj, atividadeEconomica } = req.body;
  await config.update({ razaoSocial, cnpj, atividadeEconomica });
  res.json(config);
});

module.exports = router;
