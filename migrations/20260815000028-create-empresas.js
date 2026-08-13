'use strict';

// Até aqui o sistema era single-tenant: uma linha só em `empresa_config`,
// implícita para todo o resto do sistema. Esta migration cria a tabela
// `empresas` (multi-linha, uma por empresa cliente) e migra a linha única
// que já existia (se houver) para a primeira empresa — sem perder o que já
// estava configurado (CNPJ, razão social etc.).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('empresas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nome: { type: Sequelize.STRING, allowNull: false }, // nome curto, usado no seletor de login (ex: "Codismolas")
      razaoSocial: Sequelize.STRING,
      cnpj: Sequelize.STRING,
      atividadeEconomica: Sequelize.STRING,
      cpfResponsavelRegistros: Sequelize.STRING,
      numeroRegistroInpiRepP: Sequelize.STRING,
      localPrestacaoServico: Sequelize.STRING,
      ativa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Migra a config única que já existia (se houver) para a primeira empresa
    // — mas só cria essa empresa "placeholder" se havia mesmo algo pra
    // preservar (config antiga OU colaboradores já cadastrados). Numa
    // instalação nova, sem dado legado nenhum, não faz sentido criar uma
    // "Empresa Principal" vazia — o seed.js já cria as empresas de verdade.
    const [linhasAntigas] = await queryInterface.sequelize.query('SELECT * FROM empresa_config LIMIT 1').catch(() => [[]]);
    const antiga = linhasAntigas && linhasAntigas[0];
    const [colaboradoresExistentes] = await queryInterface.sequelize.query('SELECT COUNT(*) as total FROM colaboradores').catch(() => [[{ total: 0 }]]);
    const temColaboradoresLegados = colaboradoresExistentes && Number(colaboradoresExistentes[0]?.total) > 0;

    if (antiga || temColaboradoresLegados) {
      const crypto = require('crypto');
      const agora = new Date();
      await queryInterface.bulkInsert('empresas', [{
        id: crypto.randomUUID(),
        nome: (antiga && antiga.razaoSocial) || 'Empresa Principal',
        razaoSocial: antiga ? antiga.razaoSocial : null,
        cnpj: antiga ? antiga.cnpj : null,
        atividadeEconomica: antiga ? antiga.atividadeEconomica : null,
        cpfResponsavelRegistros: antiga ? antiga.cpfResponsavelRegistros : null,
        numeroRegistroInpiRepP: antiga ? antiga.numeroRegistroInpiRepP : null,
        localPrestacaoServico: antiga ? antiga.localPrestacaoServico : null,
        ativa: true,
        createdAt: agora,
        updatedAt: agora,
      }]);
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('empresas');
  },
};
