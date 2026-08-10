require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

let sequelize;

if (process.env.DATABASE_URL) {
  // Formato do Supabase (e da maioria dos provedores gerenciados): uma única
  // connection string. Supabase exige SSL; rejectUnauthorized:false porque o
  // certificado da Supabase não é validado pela cadeia padrão do Node.
  //
  // Serverless (Vercel): cada invocação pode abrir uma conexão nova, então é
  // essencial usar a porta do CONNECTION POOLER da Supabase (6543, modo
  // "Transaction"), não a porta direta (5432) — senão o Postgres da Supabase
  // fica sem conexões disponíveis sob carga. Ver DEPLOY_SUPABASE_VERCEL.md.
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    pool: {
      max: process.env.VERCEL ? 1 : 5, // serverless: 1 conexão por instância de função
      min: 0,
      idle: 10000,
      acquire: 20000,
    },
  });
} else if (process.env.DB_DIALECT === 'postgres') {
  // Postgres "tradicional" via variáveis separadas (Docker/VPS/Render/Railway).
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    }
  );
} else {
  // SQLite: só para desenvolvimento local rápido. Não usar em produção nem em
  // ambientes serverless (o sistema de arquivos não é persistente lá).
  const storagePath = process.env.DB_STORAGE || './data/ponto.sqlite';
  const dir = path.dirname(storagePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
  });
}

module.exports = sequelize;
