// A Vercel trata qualquer módulo exportado aqui com a assinatura (req, res)
// como uma função serverless. O Express app já tem essa assinatura, então
// basta reexportá-lo — sem listen(), sem sync()/migrate() (isso é feito uma
// vez, manualmente, contra o Postgres da Supabase — ver DEPLOY_SUPABASE_VERCEL.md).
module.exports = require('../src/app');
