// Perfis de acesso do sistema. Mantido em um único lugar para ser a fonte da
// verdade tanto para validação no backend (usuarios.js) quanto para referência
// ao montar telas no frontend.
const PERFIS = ['colaborador', 'analista', 'coordenador', 'consulta', 'admin'];

const DESCRICAO_PERFIL = {
  colaborador: 'Colaborador — autoatendimento: bate o próprio ponto e vê os próprios dados',
  analista: 'Analista — lança e consulta ponto e abono; não cadastra colaborador',
  coordenador: 'Coordenador — operacional completo (colaboradores, ponto, abono, ausências, relatórios); não mexe em usuários/config',
  consulta: 'Consulta — acesso de leitura a colaboradores, relatórios, cartão de ponto e ausências',
  admin: 'Administrador — acesso total, incluindo usuários e configurações da empresa',
};

module.exports = { PERFIS, DESCRICAO_PERFIL };
