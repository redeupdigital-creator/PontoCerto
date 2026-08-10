require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'sqlite';

function base() {
  if (process.env.DATABASE_URL) {
    return {
      use_env_variable: 'DATABASE_URL',
      dialect: 'postgres',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    };
  }
  if (dialect === 'postgres') {
    return {
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    };
  }
  return {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './data/ponto.sqlite',
  };
}

module.exports = {
  development: base(),
  test: base(),
  production: base(),
};
