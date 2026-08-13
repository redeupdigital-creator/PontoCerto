// Perfis de acesso do sistema. Mantido em um único lugar para ser a fonte da
// verdade tanto para validação no backend (usuarios.js) quanto para referência
// ao montar telas no frontend.
//
// "super_admin" é PROPOSITALMENTE deixado fora dessa lista — é um perfil à
// parte, não vinculado a nenhuma empresa, e não pode ser concedido por um
// admin comum através da tela de Usuários (só existe via seed/criação direta
// no banco, ou por outro super_admin — nunca pela API de criação de usuário
// de uma empresa).
const PERFIS = ['colaborador', 'analista', 'coordenador', 'consulta', 'admin'];
const PERFIL_SUPER_ADMIN = 'super_admin';

const DESCRICAO_PERFIL = {
  colaborador: 'Colaborador — autoatendimento: bate o próprio ponto e vê os próprios dados',
  analista: 'Analista — lança e consulta ponto e abono; não cadastra colaborador',
  coordenador: 'Coordenador — operacional completo (colaboradores, ponto, abono, ausências, relatórios); não mexe em usuários/config',
  consulta: 'Consulta — acesso de leitura a colaboradores, relatórios, cartão de ponto e ausências',
  admin: 'Administrador — acesso total à própria empresa, incluindo usuários e configurações',
  [PERFIL_SUPER_ADMIN]: 'Administrador do Sistema — não pertence a nenhuma empresa; cadastra empresas novas e pode entrar em qualquer uma para suporte',
};

module.exports = { PERFIS, DESCRICAO_PERFIL, PERFIL_SUPER_ADMIN };
